/**
 * 夸克扫描王 - 凭证抓取 (http-request)
 * 匹配 scan-order.quark.cn/api/ 请求，保存 Cookie + ut + kp + token 到持久化存储
 */
const KEY = 'quark_scan_auth_v1';

function pick(source, field) {
  if (!source) return '';
  const m = source.match(new RegExp('["&?]' + field + '"?[:=]"?([^"&",}]+)'));
  return m ? m[1] : '';
}

function decodeBody(body) {
  if (!body) return '';
  // Loon 传入的 body 若为 base64 则解一次
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(body) && body.length % 4 === 0 && body.indexOf('{') !== 0) {
    try {
      const d = NSData.base64Decoded(body); // 部分环境不可用则忽略
      if (d) return d;
    } catch (e) {}
  }
  return body;
}

(function () {
  try {
    const headers = JSON.stringify($request.headers || {});
    const cookieM = headers.match(/"cookie":"([^"]+)"/i);
    const cookie = cookieM ? cookieM[1] : '';
    const url = $request.url || '';
    const body = decodeBody($request.body || '');

    let ut = pick(url, 'ut') || pick(body, 'ut');
    let kp = pick(url, 'kp') || pick(body, 'kp');
    let token = pick(body, 'token');

    if (!cookie && !ut && !token) { $done({}); return; }

    let saved = {};
    try { saved = JSON.parse($persistentStore.read(KEY) || '{}'); } catch (e) {}

    if (cookie) saved.cookie = cookie;
    if (ut) saved.ut = decodeURIComponent(ut);
    if (kp) saved.kp = decodeURIComponent(kp);
    if (token) saved.token = token;
    saved.updatedAt = Date.now();

    $persistentStore.write(JSON.stringify(saved), KEY);
    console.log('[夸克签到] 凭证已保存: cookie=' + (cookie ? 'ok' : '无') + ' ut=' + (ut ? 'ok' : '无') + ' token=' + (token ? 'ok' : '无'));
    const t = '夸克扫描王';
    if ($notification && typeof $notification.post === 'function') $notification.post(t, '凭证抓取成功', '自动签到已就绪' + (cookie && ut ? '' : '（凭证不全，多进几次签到页）'));
    else if ($notification && typeof $notification.notify === 'function') $notification.notify(t, '凭证抓取成功', '自动签到已就绪');
  } catch (e) {
    console.log('[夸克签到] 抓取异常: ' + e);
  }
  $done({});
})();
