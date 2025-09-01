import { describe, expect, it } from 'vitest'
// Import the default Worker export
import workerModule from '../../worker/index'

function makeEnv(): any {
  return {
  ASSETS: { async fetch(_req: Request) { return new Response('not found', { status: 404 }) } },
    JWT_SECRET: 'test-secret',
    NODE_ENV: 'development',
    DB: undefined,
  }
}

describe('Worker API smoke', () => {
  it('health works', async () => {
    const env = makeEnv()
    const res = await (workerModule as any).fetch(new Request('http://localhost/api/health'), env)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
