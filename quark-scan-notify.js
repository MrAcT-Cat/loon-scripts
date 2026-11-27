/**
 * 夸克扫描王 - App 签到结果提醒
 * 只读取 App 的真实响应，不发送签到请求。
 * 版本: 2026-11-27.r2
 */
(function () {
  try {
    if (typeof $response === 'undefined' || !$response) return;
    const now = Date.now();
    const day = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
    function show(kind, subtitle, text) {
      const key = 'quark_sign_notify_v2_' + kind;
      let previous = {};
      try { previous = JSON.parse($persistentStore.read(key) || '{}') || {}; } catch (_) {}
      if (previous.day === day && (kind !== 'error' || now - previous.at < 600000)) return;
      $notification.post('夸克扫描王', subtitle, text);
      // 写入失败不影响请求或真实签到，仅可能重复通知。
      try {
        if (!$persistentStore.write(JSON.stringify({day:day,at:now}), key)) console.log('[夸克签到] 通知节流记录保存失败');
      } catch (_) { console.log('[夸克签到] 通知节流记录保存失败'); }
    }
    const status = Number($response.status);
    if (!(status >= 200 && status < 300)) {
      show('error', '签到响应异常', 'HTTP 状态异常，请在 App 签到页确认结果。');
      return;
    }
    const body = $response.body;
    if (typeof body !== 'string' || !body.trim()) {
      show('error', '未读取到签到结果', '没有响应正文，请更新插件并确认 requires_body=true。');
      return;
    }
    let result;
    try { result = JSON.parse(body); } catch (_) {
      show('error', '签到响应无法解析', '返回内容不是有效 JSON，请在 App 签到页确认结果。');
      return;
    }
    if (!result || result.code !== 0 || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
      show('error', '签到未确认', '接口未返回已知成功结果，请在 App 查看。');
      return;
    }
    const d = result.data;
    const days = d.contNum;
    const reward = d.currObtainWelfare && d.currObtainWelfare.coin;
    if (typeof days !== 'number' || !Number.isInteger(days) || days < 0) {
      show('error', '签到未确认', '返回字段与已知格式不同，请在 App 查看。');
      return;
    }
    if (d.cached === true) {
      show('cached', '今日已签到', '接口返回已签到，连续 ' + days + ' 天。');
      return;
    }
    if (typeof reward !== 'number' || !Number.isFinite(reward) || reward < 0) {
      show('error', '签到未确认', '未读到明确奖励结果，请在 App 查看。');
      return;
    }
    show('success', '签到成功', '连续 ' + days + ' 天，本次 +' + reward + ' 金币。');
  } catch (_) {
    console.log('[夸克签到] 结果提醒执行异常，请查看 App 签到状态');
  } finally {
    $done({});
  }
})();
