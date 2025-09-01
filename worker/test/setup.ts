import fs from 'node:fs'
import path from 'node:path'

export const applySchema = async (mf: any) => {
  const schemaPath = path.resolve(process.cwd(), 'migrations', 'd1', 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')
  await mf.dispatchFetch('http://localhost/__miniflare_d1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/sql' },
    body: sql,
  } as any)
}
