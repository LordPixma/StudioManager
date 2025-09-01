import { beforeAll, describe, expect, it } from 'vitest'

let mf: any

beforeAll(async () => {
  // @ts-ignore provided by Miniflare environment
  mf = globalThis.__MF__
})

describe('Worker API smoke', () => {
  it('health works', async () => {
    const res = await mf.dispatchFetch('http://localhost/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
