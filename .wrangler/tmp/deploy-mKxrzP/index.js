// worker/index.ts
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN);
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("content-length");
      headers.delete("accept-encoding");
      const init = {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? void 0 : await request.clone().arrayBuffer(),
        redirect: "manual"
      };
      const resp = await fetch(target.toString(), init);
      const out = new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers
      });
      return out;
    }
    const assetResp = await env.ASSETS.fetch(request);
    if (assetResp.status === 404 && request.method === "GET") {
      const indexUrl = new URL("/index.html", url.origin);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }
    return assetResp;
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
