/**
 * 夸克扫描王 - 1002 诊断实验（临时脚本，跑完即删）
 * 从 Loon 网络栈内发送三组对照请求，定位 参数校验不通过 的原因
 * A: 新时间戳 + 随机 chid/token + 完整克隆头
 * B: 新时间戳 + 原始 chid/token（11:38 抓包）+ 完整克隆头
 * C: 完整重放（原时间戳+原 token+原头）
 */
const BASE = 'https://scan-order.quark.cn/api/sd6hJds8SIgn/pOcKNmTupWelFare';
const UT = 'LuFw5fJHq%2b1UkEW%2fgiQ2uyJERq2m4Ne22FnUZUJ28Hbq7w%3d%3d';
const KP = 'LuGDJ7ElFvs65iuRpjv3f6XIXAJwUaK7FGMlzKOrA6vaTv1%2bJgUQOr75CcpSGEP5JUHS9hcWOTRPOTDa4vpF60VJqGFrkAceNfMm4VP5bec9qA%3d%3d';
const PC = 'LuE%3d';
const HEADERS = {
  'accept': '*/*',
  'content-type': 'application/json',
  'origin': 'https://scank.quark.cn',
  'sec-fetch-site': 'same-site',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X; zh-cn) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/24B119 Quark/10.4.0.2812 Scanking/10.4.0.2812 Mobile',
  'referer': 'https://scank.quark.cn/',
  'accept-language': 'zh-Hans-TW;q=1',
  'priority': 'u=1'
};
function q(ts) {
  return '?uc_param_str=vesvutkpfrcgprospc&timestamp=' + ts + '&ve=10.4.0.2812&sv=app&ut=' + UT +
    '&kp=' + KP + '&fr=iphone&cg=default&pr=scanking&os=27.2&pc=' + PC;
}
function rnd() {
  let s = '';
  while (s.length < 32) s += Math.floor(Math.random() * 16).toString(16);
  return s.slice(0, 32);
}
function go(label, url, body) {
  return new Promise(function (resolve) {
    $httpClient.post({ url: url, headers: HEADERS, body: JSON.stringify(body) }, function (err, resp, data) {
      resolve(label + ': ' + (err ? 'ERR ' + err : String(data).slice(0, 110)));
    });
  });
}
(async function () {
  const now = Date.now();
  const A = await go('A随机', BASE + q(now), { bucket: '', product: 'filter', chid: rnd(), token: rnd() });
  const B = await go('B原token新ts', BASE + q(now), { bucket: '', product: 'filter', chid: 'de2554fe7c1644bab58bb7b8db27ecfe', token: '38fdda9f152bdd69cad6c5bc1cdbb1f9' });
  const C = await go('C纯重放', BASE + q(1794541111774), { bucket: '', product: 'filter', chid: 'de2554fe7c1644bab58bb7b8db27ecfe', token: '38fdda9f152bdd69cad6c5bc1cdbb1f9' });
  $notification.post('夸克1002诊断', 'A/B/C 结果', [A, B, C].join('\n'));
  console.log('[诊断] ' + A + ' | ' + B + ' | ' + C);
  $done();
})();
