// M0-2 将迁入真实路由
export default {
  async fetch(request, env, ctx) {
    return new Response('M0 skeleton', { status: 404 });
  }
};