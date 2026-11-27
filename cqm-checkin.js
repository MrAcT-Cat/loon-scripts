/* 穿墙猫签到 · Loon · 单账号
 * http-request：保存本机登录凭据；cron/generic：检查并签到。
 * 不输出 token/Cookie，不绕过人机验证，不自动重试 POST。
 */
(async function () {
  const BASE = 'https://wk.cqm.lol';
  const KEY = 'cqm.loon.credentials.v1';
  const capture = typeof $request !== 'undefined';
  function notify(text) {
    console.log('[穿墙猫] ' + text);
    $notification.post('穿墙猫签到', '', text);
  }
  function header(headers, name) {
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? String(headers[key] || '') : '';
  }
  try {
    if (capture) {
      if (!/^https:\/\/wk\.cqm\.lol\/api\/v1\/user\/checkin\/status(?:\?|$)/i.test($request.url || '')) return;
      const h = $request.headers || {};
      const auth = header(h, 'authorization');
      if (!auth) return;
      const saved = JSON.stringify({
        auth: auth, cookie: header(h, 'cookie'), ua: header(h, 'user-agent')
      });
      const previous = $persistentStore.read(KEY);
      if (saved !== previous) {
        if (!$persistentStore.write(saved, KEY)) throw new Error('保存凭据失败，请检查 Loon 存储。');
        if (!previous) notify('登录凭据已保存，可手动运行签到任务测试。');
        else console.log('[穿墙猫] 登录凭据已更新');
      }
      return;
    }
    const raw = $persistentStore.read(KEY);
    if (!raw) throw new Error('尚未获取凭据，请开启捕获规则后在 Safari 登录并打开仪表盘。');
    const account = JSON.parse(raw);
    if (!account || !account.auth) throw new Error('凭据不完整，请重新打开仪表盘获取。');
    const headers = { Authorization: account.auth, Accept: 'application/json', Referer: BASE + '/', Origin: BASE };
    if (account.cookie) headers.Cookie = account.cookie;
    if (account.ua) headers['User-Agent'] = account.ua;

    function api(method, path) {
      return new Promise((resolve, reject) => {
        const options = {
          url: BASE + '/api/v1/user/checkin/' + path,
          headers: Object.assign({}, headers), timeout: 15000,
          'auto-redirect': false, 'auto-cookie': false, insecure: false
        };
        if (method === 'post') options.headers['Content-Type'] = 'application/json';
        $httpClient[method](options, (error, response, body) => {
          if (error) return reject(new Error('网络请求失败；若发生在提交阶段，请先到网页确认签到状态再重跑。'));
          const status = Number(response && response.status);
          if (status === 401) return reject(new Error('登录已失效，请在 Safari 重新登录并打开仪表盘。'));
          if (status === 403 || /^\s*</.test(String(body || ''))) return reject(new Error('可能需要人机验证，请在 Safari 完成验证并刷新仪表盘。'));
          if (!(status >= 200 && status < 300)) return reject(new Error('接口 HTTP ' + status + '，请在网页检查，脚本未重试。'));
          let json;
          try { json = JSON.parse(body); } catch (_) { return reject(new Error('接口未返回有效 JSON，请在网页检查。')); }
          if (!json || typeof json !== 'object' || Array.isArray(json)) return reject(new Error('接口返回结构异常，请在网页检查。'));
          resolve(json);
        });
      });
    }
    function validate(result) {
      const d = result.data;
      if (!d || typeof d !== 'object' || typeof d.enabled !== 'boolean' || typeof d.checked_today !== 'boolean') {
        throw new Error('无法识别签到状态，请在网页检查登录状态。');
      }
      return d;
    }
    const state = validate(await api('get', 'status'));
    if (!state.enabled) throw new Error('网站暂未开放签到。');
    if (state.checked_today) { notify('今天已经签到，无需重复提交。'); return; }
    if (state.subscribe_valid !== true) throw new Error('订阅不满足签到条件，请到网页查看。');
    const result = await api('post', 'do');
    const after = validate(await api('get', 'status'));
    if (!after.checked_today) throw new Error('回查未确认签到成功，请到网页查看；脚本未重试。');
    const reward = result.data;
    const parts = [];
    if (reward && typeof reward === 'object') {
      const mb = Number(reward.traffic_reward);
      const days = Number(reward.days_reward);
      if (Number.isFinite(mb) && mb > 0) parts.push('流量 +' + mb + ' MB');
      if (Number.isFinite(days) && days > 0) parts.push('时长 +' + days + ' 天');
    }
    notify('已确认今天签到完成' + (parts.length ? '，' + parts.join('，') : '') + '。');
  } catch (error) {
    // 只展示本脚本产生的固定错误，避免解析异常携带敏感数据。
    const text = error instanceof SyntaxError ? '本机凭据数据异常，请重新获取。' : String(error.message || '执行失败，请查看网页状态。');
    notify(text);
  } finally {
    $done({});
  }
})();
