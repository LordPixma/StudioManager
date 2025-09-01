type AssetFetcher = {
  fetch: (request: Request) => Promise<Response>
}

export interface Env {
  ASSETS: AssetFetcher
  API_ORIGIN: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Proxy API requests to the configured origin
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, env.API_ORIGIN)
      const init: RequestInit = {
        method: request.method,
        headers: new Headers(request.headers),
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.clone().arrayBuffer(),
        redirect: 'manual',
      }
      // Ensure host header matches target origin
      ;(init.headers as Headers).set('host', new URL(env.API_ORIGIN).host)
      const resp = await fetch(target.toString(), init)

      // Pass-through response including cookies and headers from origin
      const out = new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
      })
      return out
    }

    // Serve static assets (SPA fallback)
    const assetResp = await env.ASSETS.fetch(request)
    if (assetResp.status === 404 && request.method === 'GET') {
      // Fallback to index.html for SPA routes
      const indexUrl = new URL('/index.html', url.origin)
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request))
    }
    return assetResp
  },
}
