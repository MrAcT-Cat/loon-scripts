/**
 * 夸克扫描王 - 每日自动签到 (cron / generic)
 * 链路：filter 查状态 → welfare_create 签到 → 通知结果
 * 凭证来自 quark-scan-cookie.js 抓取（Cookie + ut + kp + bucket）
 * 版本: 2026-11-27.r4 —— 修复：签到 body 补 bucket；移除错误的“已签”短路；
 *                         按响应 cached/contNum 准确播报；本地按日去重。
 */
const KEY = 'quark_scan_auth_v1';
const LAST_KEY = 'quark_scan_last_sign_v1';
const SIGN_URL = 'https://scan-order.quark.cn/api/sd6hJds8SIgn/pDChohbxo82nCoIn';
const STATUS_URL = 'https://scan-order.quark.cn/api/sd6hJds8SIgn/pOcKNmTupWelFare';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X; zh-cn) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/24B119 Quark/10.4.0.2812 Scanking/10.4.0.2812 Mobile';
const REFERER = 'https://scank.quark.cn/';

function randomHex(len) {
  let s = '';
  while (s.length < len) s += Math.floor(Math.random() * 16).toString(16);
  return s.slice(0, len);
}

function cnToday() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}

function post(url, headers, bodyObj, cb) {
  $httpClient.post({
    url: url,
    headers: headers,
    body: JSON.stringify(bodyObj),
    timeout: 15000
  }, function (err, resp, data) {
    cb(err, resp, data);
  });
}

function finish(sub, body) {
  const t = '夸克扫描王自动签到';
  if ($notification && typeof $notification.post === 'function') $notification.post(t, sub, body);
  else console.log('[夸克签到] ' + sub + ' ' + body);
  $done();
}

(function () {
  let saved = null;
  try { saved = JSON.parse($persistentStore.read(KEY) || 'null'); } catch (e) {}
  if (!saved || !saved.cookie || !saved.ut) {
    finish('缺少凭证', '请先打开夸克扫描王签到页，让插件抓取 Cookie/ut');
    return;
  }
  if (!saved.kp) {
    finish('凭证不完整', '缺少 kp，请重新打开签到页并停留几秒后再试');
    return;
  }
  if (!saved.bucket) {
    finish('凭证不完整', '缺少 bucket，请重新打开签到页并停留几秒后再试');
    return;
  }
  if (!saved.pc || !saved.os) {
    finish('凭证不完整', '缺少 pc/os，请重新打开签到页并停留几秒后再试');
    return;
  }
  const cookie = saved.cookie;
  const ut = saved.ut;
  const kp = saved.kp;
  const bucket = saved.bucket;
  const os = saved.os;
  const pc = saved.pc;

  // 本机当日去重：今天已成功签到就不再重复请求
  let last = '';
  try { last = $persistentStore.read(LAST_KEY) || ''; } catch (e) {}
  if (last === cnToday()) {
    finish('今日已签到', '本机记录今天已完成，无需重复提交');
    return;
  }

  // 第 1 步：查状态（filter，凭证在 query，无需 cookie）
  const ts = String(Date.now());
  const statusQ = '?uc_param_str=vesvutkpfrcgprospc&timestamp=' + ts +
    '&ve=10.4.0.2812&sv=app&ut=' + encodeURIComponent(ut) +
    '&kp=' + encodeURIComponent(kp) +
    '&fr=iphone&cg=default&pr=scanking' +
    '&os=' + encodeURIComponent(os) +
    '&pc=' + encodeURIComponent(pc);
  const statusBody = { bucket: '', product: 'filter', chid: randomHex(32), token: randomHex(32) };
  const statusHeaders = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Origin': 'https://scank.quark.cn',
    'Referer': REFERER,
    'User-Agent': UA
  };

  post(STATUS_URL + statusQ, statusHeaders, statusBody, function (err1, resp1, data1) {
    if (err1 || !data1) { finish('网络错误', '状态查询失败：' + (err1 || '空响应')); return; }
    let st = {};
    try { st = JSON.parse(data1); } catch (e) {}
    if (st.code !== 0) {
      finish('状态查询被拒', 'code=' + st.code + (st.msg ? ' ' + st.msg : '') + '，请重新打开签到页获取凭证');
      return;
    }

    // 第 2 步：签到（welfare_create，带 bucket 与 cookie）
    const signBody = {
      chid: randomHex(32),
      fr: 'iphone',
      product: 'welfare_create',
      bucket: bucket,
      ut: ut,
      ve: '10.4.0.2812',
      kp: kp,
      timestamp: ts,
      pr: 'scanking',
      token: randomHex(32)
    };
    const signHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': cookie,
      'User-Agent': UA,
      'Referer': REFERER
    };

    post(SIGN_URL, signHeaders, signBody, function (err2, resp2, data2) {
      if (err2 || !data2) { finish('网络错误', '签到请求失败：' + (err2 || '空响应')); return; }
      let r = {};
      try { r = JSON.parse(data2); } catch (e) {}
      if (r.code === 2001) {
        finish('登录失效', '请重新打开夸克扫描王签到页，让插件更新凭证');
        return;
      }
      if (r.code !== 0 || !r.data) {
        finish('签到失败', 'code=' + r.code + (r.msg ? ' ' + r.msg : ''));
        return;
      }
      const d = r.data;
      const contNum = typeof d.contNum === 'number' ? d.contNum : 0;
      const coin = (d.currObtainWelfare && d.currObtainWelfare.coin) || 0;
      try { $persistentStore.write(cnToday(), LAST_KEY); } catch (e) {}
      if (d.cached === true) {
        finish('今日已签到', '连续 ' + contNum + ' 天（服务端返回已签到）');
      } else {
        finish('签到成功 🎉', '连续 ' + contNum + ' 天，本次 +' + coin + ' 金币');
      }
    });
  });
})();
