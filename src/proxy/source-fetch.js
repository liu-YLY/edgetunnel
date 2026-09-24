const 响应字节上限 = 512 * 1024;
function 优选错误(state, httpStatus) { return Object.assign(new Error('优选源请求失败'), { sourceState: state, httpStatus }); }
function 优选来源结果(source, state, count = 0, httpStatus) {
  const messages = { ok: '成功解析', partial: '部分内容无效，已保留可用节点', empty: '返回空列表', parse_error: '返回内容无法解析为节点列表', timeout: '请求超时', network_error: '网络连接失败', invalid_url: '来源地址无效', too_large: '响应超过 512 KiB 限制', redirect_limit: '重定向次数超出限制', limited: '达到来源数量限制，未请求', fallback: '已使用内置地址段兜底' };
  return { source, state, count, message: state === 'http_error' ? '远端返回 HTTP ' + httpStatus : (messages[state] || messages.network_error) };
}

// 每个来源包含重定向和响应体读取的总预算；避免只限制等待响应头。
async function 读取优选响应(input, timeout = 3000, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let reader;
  try {
    let url;
    try { url = new URL(input); } catch (_) { throw 优选错误('invalid_url'); }
    let response;
    for (let redirect = 0; ; redirect++) {
      if (!['https:', 'http:'].includes(url.protocol)) throw 优选错误('invalid_url');
      response = await fetch(url.href, { headers, signal: controller.signal, redirect: 'manual' });
      if (![301,302,303,307,308].includes(response.status)) break;
      await response.body?.cancel();
      if (redirect >= 2) throw 优选错误('redirect_limit');
      const location = response.headers.get('location');
      if (!location) throw 优选错误('invalid_url');
      try { url = new URL(location, url); } catch (_) { throw 优选错误('invalid_url'); }
    }
    if (!response.ok) { await response.body?.cancel(); throw 优选错误('http_error', response.status); }
    if (Number(response.headers.get('content-length')) > 响应字节上限) { await response.body?.cancel(); throw 优选错误('too_large'); }
    const chunks = []; let size = 0;
    if (response.body) {
      reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 响应字节上限) { await reader.cancel(); throw 优选错误('too_large'); }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { bytes, contentType: response.headers.get('content-type') || '' };
  } catch (error) {
    if (error.sourceState) throw error;
    throw 优选错误(controller.signal.aborted || ['AbortError','TimeoutError'].includes(error.name) ? 'timeout' : 'network_error');
  } finally { clearTimeout(timer); reader?.releaseLock(); }
}

export { 读取优选响应, 优选来源结果, 优选错误 };
