// Node unit tests only. Production and workerd use the real platform module.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:sockets') {
    return { url: new URL('./sockets.mjs', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
