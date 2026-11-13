/**
 * 夸克扫描王 - 每日自动签到 (cron)
 * 链路：filter 接口查状态 → welfare_create 签到 → 通知结果
 * 凭证来自 quark-scan-cookie.js 抓取（Cookie + ut + kp + token）
 */
const KEY = 'quark_scan_auth_v1';
const SIGN_URL = 'https://scan-order.quark.cn/api/sd6hJds8SIgn/pDChohbxo82nCoIn';
const STATUS_URL = 'https://scan-order.quark.cn/api/sd6hJds8SIgn/pOcKNmTupWelFare';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X; zh-cn) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/24B119 Quark/10.4.0.2812 Scanking/10.4.0.2812 Mobile';
const REFERER = 'https://scank.quark.cn/';

function randomHex(len) {
  let s = '';
  while (s.length < len) s += Math.floor(Math.random() * 16).toString(16);
  return s.slice(0, len);
}

function post(url, bodyObj, cookie, cb) {
  $httpClient.post({
    url: url,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'User-Agent': UA,
      'Referer': REFERER
    },
    body: JSON.stringify(bodyObj)
  }, function (err, resp, data) {
    cb(err, resp, data);
  });
}

function notify(sub, body) {
  const t = '夸克扫描王自动签到';
  if ($notification && typeof $notification.post === 'function') $notification.post(t, sub, body);
  else if ($notification && typeof $notification.notify === 'function') $notification.notify(t, sub, body);
  else console.log('[夸克签到] ' + sub + ' ' + body);
  $done();
}

(function () {
  let saved = null;
  try { saved = JSON.parse($persistentStore.read(KEY) || 'null'); } catch (e) {}
  if (!saved || !saved.cookie || !saved.ut) {
    notify('缺少凭证', '请先打开夸克扫描王 App 进入一次签到页，让插件抓取 Cookie');
    return;
  }
  const cookie = saved.cookie;
  const ut = saved.ut;
  const kp = saved.kp || '';
  const now = String(Date.now());

  // 第 1 步：查签到状态（顺带验证凭证有效性）
  const statusQ = '?uc_param_str=vesvutkpfrcgprospc&timestamp=' + now +
    '&ve=10.4.0.2812&sv=app&ut=' + encodeURIComponent(ut) +
    (kp ? '&kp=' + encodeURIComponent(kp) : '') +
    '&fr=iphone&cg=default&pr=scanking';
  const statusBody = { bucket: '', product: 'filter', chid: randomHex(32), token: randomHex(32) };

  post(STATUS_URL + statusQ, statusBody, cookie, function (err1, resp1, data1) {
    if (err1 || !data1) { notify('网络错误', '状态查询失败：' + (err1 || '空响应')); return; }
    let st = {};
    try { st = JSON.parse(data1); } catch (e) {}
    if (st.code !== 0) {
      notify('状态查询被拒', String(data1).slice(0, 140));
      return;
    }
    // 已签判断：今天这一格 signed=true 则跳过
    const welfare = (st.data && st.data.signWelfare) || [];
    const signedDays = welfare.filter(function (d) { return d.signed; }).length;
    const contNum = (st.data && st.data.contNum) || 0;
    const allSigned = welfare.length > 0 && welfare[welfare.length - 1].signed === true && signedDays >= welfare.length;
    // 粗略判断：连续天数 >= 已签格数时视为今日已签
    if (allSigned || (contNum > 0 && signedDays >= contNum && signedDays > 0)) {
      notify('今日已签到', '连续 ' + contNum + ' 天，金币 ' + ((st.data && st.data.validCoins) || '?'));
      return;
    }

    // 第 2 步：签到
    const signBody = {
      chid: randomHex(32),
      fr: 'iphone',
      product: 'welfare_create',
      ut: ut,
      ve: '10.4.0.2812',
      kp: kp,
      timestamp: now,
      pr: 'scanking',
      token: randomHex(32)
    };
    post(SIGN_URL, signBody, cookie, function (err2, resp2, data2) {
      if (err2 || !data2) { notify('网络错误', '签到请求失败：' + (err2 || '空响应')); return; }
      let r = {};
      try { r = JSON.parse(data2); } catch (e) {}
      if (r.code === 0 && r.data) {
        const d = r.data;
        const coin = (d.currObtainWelfare && d.currObtainWelfare.coin) || 0;
        if (d.cached === true) {
          notify('今日已签到', '连续 ' + d.contNum + ' 天，无需重复签到');
        } else {
          notify('签到成功 🎉', '连续 ' + d.contNum + ' 天，本次 +' + coin + ' 金币');
        }
        if (saved.token) {
          // token 每次随机生成即可，不回写
        }
      } else {
        notify('签到失败', String(data2).slice(0, 140));
      }
      $done();
    });
  });
})();
