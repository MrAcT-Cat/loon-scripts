/**
 * 夸克扫描王 - 每日自动签到 (cron / generic)
 * 直接调用 welfare_create 签到（不先查 filter 状态；filter 带反重放校验 1002，非签到必需）。
 * 凭证来自 quark-scan-cookie.js 抓取（Cookie + ut + kp + bucket）
 * 版本: 2026-11-27.r7 —— 跳过 filter，直接 welfare_create；按 cached 判断已签。
 */
const KEY = 'quark_scan_auth_v1';
const LAST_KEY = 'quark_scan_last_sign_v1';
const VER = 'v7';
const SIGN_URL = 'https://scan-order.quark.cn/api/sd6hJds8SIgn/pDChohbxo82nCoIn';
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

function finish(sub, body) {
  const t = '夸克扫描王自动签到';
  if ($notification && typeof $notification.post === 'function') $notification.post(t, sub + '（' + VER + '）', body);
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
  const cookie = saved.cookie;
  const ut = saved.ut;
  const kp = saved.kp;
  const bucket = saved.bucket;

  // 本机当日去重：今天已成功签到就不再重复请求
  let last = '';
  try { last = $persistentStore.read(LAST_KEY) || ''; } catch (e) {}
  if (last === cnToday()) {
    finish('今日已签到', '本机记录今天已完成，无需重复提交');
    return;
  }

  // 直接签到（welfare_create，带 bucket 与 cookie）
  const ts = String(Date.now());
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

  $httpClient.post({
    url: SIGN_URL,
    headers: signHeaders,
    body: JSON.stringify(signBody),
    timeout: 15000
  }, function (err2, resp2, data2) {
    if (err2 || !data2) { finish('网络错误', '签到请求失败：' + (err2 || '空响应')); return; }
    let r = {};
    try { r = JSON.parse(data2); } catch (e) {}
    if (r.code === 2001) {
      finish('登录失效', '请重新打开夸克扫描王签到页，让插件更新凭证');
      return;
    }
    if (r.code === 1002) {
      finish('签到被拒', 'code=1002 参数校验不通过，可能需真机打开签到页完成签到');
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
})();
