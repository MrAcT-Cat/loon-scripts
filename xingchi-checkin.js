/**
 * 星驰API 每日签到 · Loon
 * http-response：抓登录/刷新响应，保存 access_token + refresh_token + 过期时间。
 * cron/generic：查签到状态 → 未签则签到；token 过期则先用 refresh_token 刷新。
 * 版本: 2026-11-28.r1
 */
const KEY = 'xingchi.loon.credentials.v1';
const BASE = 'https://xingchiapi.com';
const capture = typeof $response !== 'undefined';

function notify(text) {
  console.log('[星驰签到] ' + text);
  $notification.post('星驰签到', '', text);
}

// 从登录/刷新响应里抽取 token 三元组
function pickTokens(json) {
  if (!json || typeof json !== 'object') return null;
  const d = json.data || json;
  if (!d || typeof d !== 'object') return null;
  if (d.access_token && d.refresh_token) {
    return { token: String(d.access_token), refresh: String(d.refresh_token), expiresIn: Number(d.expires_in) || 0 };
  }
  return null;
}

(async function () {
  try {
    if (capture) {
      // 只在登录/刷新成功响应里抓 token
      const url = (typeof $request !== 'undefined' ? $request.url : '') || '';
      if (!/\/api\/v1\/auth\/(login|refresh)$/i.test(url)) return;
      const status = Number($response && $response.status);
      if (!(status >= 200 && status < 300)) return;
      let json = null;
      try { json = JSON.parse($response.body || '{}'); } catch (_) {}
      const t = pickTokens(json);
      if (!t) return;
      const saved = JSON.stringify({
        token: t.token,
        refresh: t.refresh,
        expiresAt: t.expiresIn > 0 ? Date.now() + t.expiresIn * 1000 : 0
      });
      const prev = $persistentStore.read(KEY);
      if (saved !== prev) {
        $persistentStore.write(saved, KEY);
        if (!prev) notify('登录凭证已保存，可手动运行签到任务测试。');
        else console.log('[星驰签到] 凭证已更新');
      }
      return;
    }

    // —— 签到逻辑 ——
    let saved = null;
    try { saved = JSON.parse($persistentStore.read(KEY) || 'null'); } catch (_) {}
    if (!saved || !saved.token || !saved.refresh) {
      notify('缺少凭证，请先在 Safari 登录 xingchiapi.com 一次。');
      return;
    }

    function api(method, path, token, body) {
      return new Promise((resolve, reject) => {
        const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        $httpClient[method]({
          url: BASE + path,
          headers: headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          timeout: 15000
        }, (err, resp, data) => {
          if (err) return reject(new Error('网络错误'));
          const status = Number(resp && resp.status);
          let json = null;
          try { json = JSON.parse(data); } catch (_) {}
          resolve({ status, json });
        });
      });
    }

    async function refresh() {
      const r = await api('post', '/api/v1/auth/refresh', saved.token, { refresh_token: saved.refresh });
      if (r.status >= 200 && r.status < 300) {
        const t = pickTokens(r.json);
        if (t) {
          saved.token = t.token;
          saved.refresh = t.refresh;
          saved.expiresAt = t.expiresIn > 0 ? Date.now() + t.expiresIn * 1000 : 0;
          $persistentStore.write(JSON.stringify(saved), KEY);
          return true;
        }
      }
      return false;
    }

    // token 过期（留 5 分钟余量）则先刷新
    if (saved.expiresAt && saved.expiresAt - Date.now() < 5 * 60000) {
      if (!(await refresh())) {
        notify('凭证已失效，请重新在 Safari 登录 xingchiapi.com。');
        return;
      }
    }

    // 查签到状态
    let st = await api('get', '/api/v1/user/checkin?timezone=Asia%2FShanghai', saved.token);
    if (st.status === 401) {
      if (!(await refresh())) { notify('凭证已失效，请重新登录。'); return; }
      st = await api('get', '/api/v1/user/checkin?timezone=Asia%2FShanghai', saved.token);
    }
    if (st.status !== 200) { notify('查询状态失败 HTTP ' + st.status); return; }

    const d = st.json && st.json.data;
    if (d && d.claimed_today === true) {
      notify('今天已经签到，无需重复。累计 ' + (d.total_count || 0) + ' 次 / ' + (d.total_amount || 0) + ' 额度。');
      return;
    }

    // 执行签到
    let r = await api('post', '/api/v1/user/checkin', saved.token, { timezone: 'Asia/Shanghai' });
    if (r.status === 401) {
      if (!(await refresh())) { notify('凭证已失效，请重新登录。'); return; }
      r = await api('post', '/api/v1/user/checkin', saved.token, { timezone: 'Asia/Shanghai' });
    }
    if (r.status === 409) {
      notify('今天已经签到（服务端确认）。');
      return;
    }
    if (r.status !== 200) {
      notify('签到失败 HTTP ' + r.status + '：' + ((r.json && r.json.message) || ''));
      return;
    }
    const rd = r.json && r.json.data;
    const amount = (rd && rd.amount) || 300;
    const total = rd && rd.total_count;
    notify('签到成功，本次 +' + amount + ' 额度' + (total !== undefined ? '，累计 ' + total + ' 次' : '') + '。');
  } catch (e) {
    notify('执行失败：' + (e && e.message ? e.message : '未知错误'));
  } finally {
    $done({});
  }
})();
