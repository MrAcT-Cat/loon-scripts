/**
 * 夸克扫描王 - 签到状态提醒
 * 只读签到页状态查询（pOcKNmTupWelFare）的响应，读取连续签到天数，按天节流提醒。
 * 不伪造请求、不修改响应；真正的签到动作由 App 自行完成。
 * 版本: 2026-11-28.r3
 */
const KEY = 'quark_sign_remind_v3';

(function () {
  try {
    if (typeof $response === 'undefined' || !$response) return;
    const status = Number($response.status);
    if (!(status >= 200 && status < 300)) return;

    const body = $response.body;
    if (typeof body !== 'string' || !body.trim()) return;

    let r;
    try { r = JSON.parse(body); } catch (_) { return; }
    if (!r || r.code !== 0 || !r.data || typeof r.data !== 'object' || Array.isArray(r.data)) return;

    const contNum = r.data.contNum;
    if (typeof contNum !== 'number' || !Number.isInteger(contNum) || contNum < 0) return;

    // 按天节流：每天只提醒一次，避免反复弹
    const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    let last = '';
    try { last = $persistentStore.read(KEY) || ''; } catch (_) {}
    if (last === day) return;
    try { $persistentStore.write(day, KEY); } catch (_) {}

    $notification.post('夸克扫描王', '签到状态提醒', '当前连续签到 ' + contNum + ' 天');
  } catch (_) {
    // 静默失败，不影响 App 正常签到
  } finally {
    $done({});
  }
})();
