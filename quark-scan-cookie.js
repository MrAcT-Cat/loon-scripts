/**
 * 夸克扫描王 - 凭证抓取 (http-request / Loon request 脚本)
 * 匹配 scan-order.quark.cn/api/ 请求，保存 Cookie + ut + kp + token 到持久化存储
 * 版本: 2026-11-13.r2 —— 无论结果如何都给出可见反馈，便于排查
 */
const KEY = 'quark_scan_auth_v1';

function pickIn(source, field) {
  if (!source) return '';
  const re = new RegExp('["&?]' + field + '"?\\s*[:=]\\s*"?([^"&,}\\s]+)');
  const m = source.match(re);
  return m ? m[1] : '';
}

function decodeBody(body) {
  if (!body) return '';
  if (typeof body === 'string' && body.indexOf('{') !== 0 && /^[A-Za-z0-9+/=\r\n]+$/.test(body)) {
    try {
      const d = Buffer.from(body, 'base64').toString('utf8');
      if (d.indexOf('{') === 0) return d;
    } catch (e) {}
  }
  return body;
}

(function () {
  try {
    const reqUrl = $request.url || '';
    const headersJson = JSON.stringify($request.headers || {});
    const cookieM = headersJson.match(/"cookie"\s*:\s*"([^"]+)"/i);
    const cookie = cookieM ? cookieM[1] : '';
    const body = decodeBody($request.body || '');

    const ut = pickIn(reqUrl, 'ut') || pickIn(body, 'ut');
    const kp = pickIn(reqUrl, 'kp') || pickIn(body, 'kp');
    const token = pickIn(body, 'token');

    console.log('[夸克签到] 拦截到请求: ' + reqUrl.slice(0, 120));
    console.log('[夸克签到] 提取结果 cookie=' + (cookie ? cookie.length + 'B' : '无') +
      ' ut=' + (ut ? 'ok' : '无') + ' kp=' + (kp ? 'ok' : '无') + ' token=' + (token ? 'ok' : '无'));

    if (!cookie && !ut && !token) {
      $notification.post('夸克扫描王', '抓取诊断', '拦截到请求但没提取到凭证，请把 Loon 脚本日志发我');
      $done({});
      return;
    }

    let saved = {};
    try { saved = JSON.parse($persistentStore.read(KEY) || '{}'); } catch (e) {}

    if (cookie) saved.cookie = cookie;
    if (ut) saved.ut = decodeURIComponent(ut);
    if (kp) saved.kp = decodeURIComponent(kp);
    if (token) saved.token = token;
    saved.updatedAt = Date.now();

    $persistentStore.write(JSON.stringify(saved), KEY);
    const full = cookie && ut;
    $notification.post('夸克扫描王', '凭证抓取' + (full ? '成功 ✅' : '部分成功'), full
      ? '自动签到已就绪，明天早上见'
      : 'Cookie=' + (cookie ? '有' : '无') + ' ut=' + (ut ? '有' : '无') + '，请多在签到页停留几秒再退出');
  } catch (e) {
    console.log('[夸克签到] 抓取异常: ' + e);
    try { $notification.post('夸克扫描王', '抓取脚本异常', String(e)); } catch (e2) {}
  }
  $done({});
})();
