/**
 * 夸克扫描王 - 凭证抓取 (Loon request 脚本)
 * 匹配 scan-order.quark.cn 任意请求，保存 Cookie + ut + kp 到持久化存储
 * 版本: 2026-11-13.r3 —— 不依赖请求体；60 秒节流防通知轰炸
 */
const KEY = 'quark_scan_auth_v1';
const THROTTLE_KEY = 'quark_scan_notify_at';
const THROTTLE_MS = 60 * 1000;

function pickIn(source, field) {
  if (!source) return '';
  const re = new RegExp('["&?]' + field + '"?\\s*[:=]\\s*"?([^"&,}\\s]+)');
  const m = source.match(re);
  return m ? m[1] : '';
}

(function () {
  try {
    const reqUrl = $request.url || '';
    const headersJson = JSON.stringify($request.headers || {});
    const cookieM = headersJson.match(/"cookie"\s*:\s*"([^"]+)"/i);
    const cookie = cookieM ? cookieM[1] : '';
    const body = (typeof $request.body === 'string') ? $request.body : '';

    const ut = pickIn(reqUrl, 'ut') || pickIn(body, 'ut');
    const kp = pickIn(reqUrl, 'kp') || pickIn(body, 'kp');

    console.log('[夸克签到] 拦截: ' + reqUrl.split('?')[0]);
    console.log('[夸克签到] cookie=' + (cookie ? cookie.length + 'B' : '无') + ' ut=' + (ut ? 'ok' : '无') + ' kp=' + (kp ? 'ok' : '无'));

    if (!cookie && !ut) { $done({}); return; }

    let saved = {};
    try { saved = JSON.parse($persistentStore.read(KEY) || '{}'); } catch (e) {}

    const changed = (cookie && cookie !== saved.cookie) || (ut && ut !== saved.ut) || (kp && kp !== saved.kp);
    if (cookie) saved.cookie = cookie;
    if (ut) saved.ut = decodeURIComponent(ut);
    if (kp) saved.kp = decodeURIComponent(kp);
    saved.updatedAt = Date.now();
    $persistentStore.write(JSON.stringify(saved), KEY);

    // 节流：凭证无变化或 60 秒内已通知过则安静退出
    let lastNotify = 0;
    try { lastNotify = parseInt($persistentStore.read(THROTTLE_KEY) || '0', 10) || 0; } catch (e) {}
    if (!changed && Date.now() - lastNotify < 24 * 3600 * 1000) { $done({}); return; }
    if (Date.now() - lastNotify < THROTTLE_MS) { $done({}); return; }
    $persistentStore.write(String(Date.now()), THROTTLE_KEY);

    const full = cookie && ut;
    $notification.post('夸克扫描王', '凭证抓取' + (full ? '成功 ✅' : '部分成功'), full
      ? '自动签到已就绪，明天早上见'
      : 'Cookie=' + (cookie ? '有' : '无') + ' ut=' + (ut ? '有' : '无') + '，请在签到页多停留几秒');
  } catch (e) {
    console.log('[夸克签到] 抓取异常: ' + e);
    try { $notification.post('夸克扫描王', '抓取脚本异常', String(e)); } catch (e2) {}
  }
  $done({});
})();
