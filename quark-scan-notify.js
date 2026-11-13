/**
 * 夸克扫描王 - 签到结果播报（配合快捷指令每日自动打开 App）
 * 双模式：response 阶段解析真实签到响应；request 阶段静默（防止重复通知）
 * 版本: 2026-11-13.r1
 */
const THROTTLE_KEY = 'quark_sign_notify_at';
const THROTTLE_MS = 6 * 3600 * 1000;

(function () {
  try {
    if (typeof $response === 'undefined' || !$response) { $done({}); return; }
    const c = $response.body || '';
    let r = {};
    try { r = JSON.parse(c); } catch (e) {}
    if (!r || r.code !== 0 || !r.data) {
      // 响应异常也播报一次（节流内不重复）
      $notification.post('夸克扫描王', '签到响应异常', String(c).slice(0, 120));
      $done({});
      return;
    }
    let last = 0;
    try { last = parseInt($persistentStore.read(THROTTLE_KEY) || '0', 10) || 0; } catch (e) {}
    if (Date.now() - last < THROTTLE_MS) { $done({}); return; }
    $persistentStore.write(String(Date.now()), THROTTLE_KEY);

    const d = r.data;
    const coin = (d.currObtainWelfare && d.currObtainWelfare.coin) || 0;
    if (d.cached === true) {
      $notification.post('夸克扫描王', '今日已签到 ✅', '连续 ' + d.contNum + ' 天（App 已自动完成）');
    } else {
      $notification.post('夸克扫描王', '签到成功 🎉', '连续 ' + d.contNum + ' 天，本次 +' + coin + ' 金币');
    }
  } catch (e) {
    console.log('[夸克签到] 播报异常: ' + e);
  }
  $done({});
})();
