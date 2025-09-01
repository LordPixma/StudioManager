type AssetFetcher = {
  fetch: (request: Request) => Promise<Response>
}

// D1Database is available in the Workers runtime types
export interface Env {
  ASSETS: AssetFetcher
  // Bind a D1 database as "DB" in wrangler.toml when ready
  DB?: any
  JWT_SECRET?: string
  NODE_ENV?: string
  ROOM_LOCK: any
}

type ApiResponse<T = any> = {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
  meta?: any
}

function json<T>(body: ApiResponse<T>, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  // Security headers (aligned with Flask app)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  // Minimal CSP; Pages handles assets, API is same-origin
  headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'")
  return new Response(JSON.stringify(body), { ...init, headers })
}

// --- Tenant resolution from Host or dev override ---
async function resolveTenantFromRequest(env: Env, request: Request): Promise<any | null> {
  if (!env.DB) return null
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') || url.host
  const overrideId = request.headers.get('x-tenant-id')
  const overrideSub = request.headers.get('x-tenant-subdomain')
  // Dev overrides take precedence
  if (overrideId) {
    const t = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [parseInt(overrideId, 10)])
    return t || null
  }
  if (overrideSub) {
    const t = await dbFirst(env, 'SELECT * FROM tenants WHERE subdomain = ? LIMIT 1', [overrideSub.toLowerCase()])
    return t || null
  }
  // Skip subdomain parsing for localhost
  if (/localhost|127\.0\.0\.1/.test(host)) return null
  const hostname = host.split(':')[0]
  const parts = hostname.split('.')
  if (parts.length < 3) return null // likely apex or www only
  const sub = parts[0].toLowerCase()
  const t = await dbFirst(env, 'SELECT * FROM tenants WHERE subdomain = ? LIMIT 1', [sub])
  return t || null
}

async function handleHealth(): Promise<Response> {
  return json({ success: true, data: { status: 'healthy' } })
}

async function handleReadiness(env: Env): Promise<Response> {
  if (!env.DB) {
    return json({ success: false, message: 'DB not bound' }, { status: 503 })
  }
  try {
    // Simple readiness query compatible with D1
  const row: any = await env.DB.prepare('SELECT 1 as ok').first()
    if (row && row.ok === 1) {
      return json({ success: true, data: { db: 'ok' } })
    }
    return json({ success: false, message: 'DB check failed' }, { status: 503 })
  } catch (e: any) {
    return json({ success: false, message: `DB not ready: ${e?.message || String(e)}` }, { status: 503 })
  }
}

// (Proxy to legacy API removed) Unknown /api routes will return 404.

// --- Auth helpers (JWT in httpOnly cookie) ---
const SESSION_COOKIE = 'sm_session'

function base64UrlEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const b64 = btoa(bin)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecodeToUint8Array(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function signJWT(payload: Record<string, any>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const enc = new TextEncoder()
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)))
  const data = `${headerB64}.${payloadB64}`
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigB64 = base64UrlEncode(sig)
  return `${data}.${sigB64}`
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
  try {
    const [h, p, s] = token.split('.')
    if (!h || !p || !s) return null
    const data = `${h}.${p}`
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const sigBytes = base64UrlDecodeToUint8Array(s)
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, enc.encode(data).buffer as ArrayBuffer)
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecodeToUint8Array(p)))
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

function sessionCookie(token: string, url: URL, maxAgeSeconds: number): string {
  const secure = url.protocol === 'https:'
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
  ]
  if (secure) parts.push('Secure')
  if (maxAgeSeconds > 0) parts.push(`Max-Age=${maxAgeSeconds}`)
  return parts.join('; ')
}

function clearSessionCookie(url: URL): string {
  const secure = url.protocol === 'https:'
  const parts = [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function isoPlusMinutes(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// Werkzeug-compatible PBKDF2: pbkdf2:sha256[:iter]\$salt\$hash(base64)
async function verifyWerkzeugPBKDF2(password: string, hashStr: string): Promise<boolean> {
  try {
    const parts = hashStr.split('$')
    if (parts.length !== 3) return false
    const [methodPart, salt, stored] = parts
    const methodBits = methodPart.split(':')
    if (methodBits[0] !== 'pbkdf2' || methodBits[1] !== 'sha256') return false
    const iterations = parseInt(methodBits[2] || '260000', 10)
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, keyMaterial, 256)
    const derivedB64 = base64UrlEncode(bits).replace(/-/g, '+').replace(/_/g, '/') // convert to standard b64
    // stored is standard base64 (no url-safe); strip any padding before compare
    const s1 = (stored || '').replace(/=+$/, '')
    const s2 = derivedB64.replace(/=+$/, '')
    return s1 === s2
  } catch {
    return false
  }
}

// Cloudflare Workers WebCrypto limits PBKDF2 iterations to 100000; cap generation accordingly.
async function generateWerkzeugPBKDF2(password: string, iterations = 100000): Promise<string> {
  const iters = Math.min(iterations, 100000)
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let salt = ''
  for (let i = 0; i < 16; i++) salt += alphabet[Math.floor(Math.random() * alphabet.length)]
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: iters }, keyMaterial, 256)
  // Standard base64 for storage
  const bytes = new Uint8Array(bits)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const b64 = btoa(bin)
  return `pbkdf2:sha256:${iters}$${salt}$${b64}`
}

// DB helpers
async function dbFirst(env: Env, sql: string, params: any[] = []): Promise<any | null> {
  let stmt: any = env.DB.prepare(sql)
  if (params.length) {
    stmt = stmt.bind(...params)
  }
  return (stmt.first ? await stmt.first() : null) as any
}

async function dbRun(env: Env, sql: string, params: any[] = []): Promise<void> {
  let stmt: any = env.DB.prepare(sql)
  if (params.length) {
    stmt = stmt.bind(...params)
  }
  await stmt.run()
}

async function handleLogin(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const body = await request.json().catch(() => ({})) as any
  const email = (body.email || '').toLowerCase().trim()
  const password = body.password || ''
  const remember = !!body.remember_me
  if (!email || !password) return json({ success: false, message: 'Email and password are required' }, { status: 400 })
  const user = await dbFirst(env, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email])
  if (!user) return json({ success: false, message: 'Invalid email or password' }, { status: 401 })
  if (!user.is_active) return json({ success: false, message: 'Account is deactivated' }, { status: 401 })
  const ok = await verifyWerkzeugPBKDF2(password, user.password_hash)
  if (!ok) return json({ success: false, message: 'Invalid email or password' }, { status: 401 })
  // Enforce subdomain tenancy if present
  const hostTenant = await resolveTenantFromRequest(env, request)
  if (hostTenant && user.tenant_id && user.tenant_id !== hostTenant.id) {
    return json({ success: false, message: 'Tenant mismatch for this domain' }, { status: 401 })
  }
  if (user.tenant_id) {
    const tenant = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [user.tenant_id])
    if (!tenant || !tenant.is_active) return json({ success: false, message: 'Studio account is not active' }, { status: 401 })
  }
  const expSecs = remember ? 60 * 60 * 24 * 30 : 60 * 60
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub: user.id, tid: user.tenant_id, sid: user.studio_id, role: user.role, iat: now, exp: now + expSecs }
  if (!env.JWT_SECRET) return json({ success: false, message: 'JWT secret not configured' }, { status: 500 })
  const token = await signJWT(payload, env.JWT_SECRET)
  const headers = new Headers()
  headers.append('Set-Cookie', sessionCookie(token, url, expSecs))
  return json({ success: true, data: { user: serializeUser(user), session_timeout: isoPlusMinutes(60) }, message: 'Login successful' }, { headers })
}

function serializeUser(u: any) {
  const permissions = (() => { try { return JSON.parse(u.permissions || '[]') } catch { return [] } })()
  return { id: u.id, tenant_id: u.tenant_id, name: u.name, email: u.email, role: u.role, permissions, studio_id: u.studio_id, is_active: !!u.is_active, created_at: u.created_at }
}

async function getUserFromSession(request: Request, env: Env): Promise<any | null> {
  const url = new URL(request.url)
  const cookie = request.headers.get('Cookie') || ''
  const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!m) return null
  const token = m[1]
  if (!env.JWT_SECRET) return null
  const payload = await verifyJWT(token, env.JWT_SECRET)
  if (!payload) return null
  const user = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [payload.sub])
  return user || null
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const user = await getUserFromSession(request, env)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })
  return json({ success: true, data: { user: serializeUser(user), session_timeout: isoPlusMinutes(60) } })
}

async function handleLogout(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const headers = new Headers()
  headers.append('Set-Cookie', clearSessionCookie(url))
  return json({ success: true, message: 'Logged out' }, { headers })
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const data = await request.json().catch(() => ({})) as any
  const name = (data.name || '').trim()
  const email = (data.email || '').toLowerCase().trim()
  const password = data.password || ''
  let tenant_name = (data.tenant_name || '').trim()
  const tenant_id = data.tenant_id
  const errors: Record<string, string[]> = {}
  const addErr = (k: string, v: string) => { (errors[k] ||= []).push(v) }
  if (!name) addErr('name', 'Name is required')
  if (!email) addErr('email', 'Email is required')
  else if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) addErr('email', 'Invalid email format')
  if (!password) addErr('password', 'Password is required')
  else if (password.length < 8) addErr('password', 'Password must be at least 8 characters')
  const existing = await dbFirst(env, 'SELECT id FROM users WHERE email = ? LIMIT 1', [email])
  if (existing) addErr('email', 'Email already registered')
  if (!tenant_name && !tenant_id) tenant_name = name ? `${name}'s Studio` : ''
  if (!tenant_name && !tenant_id) addErr('tenant_name', 'Studio/Company name is required for new registration')
  if (Object.keys(errors).length) return json({ success: false, errors }, { status: 400 })

  try {
    if (tenant_name && !tenant_id) {
      const subdomain = (tenant_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20) || 'studio')
      await dbRun(env, 'INSERT INTO tenants (name, subdomain, plan, is_active) VALUES (?,?,?,1)', [tenant_name, subdomain, 'free'])
      const tenant = await dbFirst(env, 'SELECT * FROM tenants WHERE subdomain = ? ORDER BY id DESC LIMIT 1', [subdomain])
      await dbRun(env, 'INSERT INTO studios (tenant_id, name) VALUES (?, ?)', [tenant.id, `${tenant_name} - Main Studio`])
      const studio = await dbFirst(env, 'SELECT * FROM studios WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [tenant.id])
      const hash = await generateWerkzeugPBKDF2(password)
      await dbRun(env, 'INSERT INTO users (tenant_id, studio_id, name, email, password_hash, role, permissions, is_active) VALUES (?,?,?,?,?,?,?,1)', [tenant.id, studio.id, name, email, hash, 'Studio Manager', JSON.stringify(['view_customers','create_customer','edit_customer','delete_customer','view_bookings','create_booking','edit_booking','cancel_booking','view_staff','create_staff','edit_staff','view_reports','manage_studio'])])
      const user = await dbFirst(env, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email])
      const payload = { user: serializeUser(user), session_timeout: isoPlusMinutes(60) }
      return json({ success: true, data: payload, message: 'Registration successful' }, { status: 201 })
    } else {
      if (!tenant_id) return json({ success: false, message: 'Tenant ID required' }, { status: 400 })
      const tenant = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [tenant_id])
      if (!tenant || !tenant.is_active) return json({ success: false, message: 'Invalid tenant' }, { status: 400 })
      const studio = await dbFirst(env, 'SELECT * FROM studios WHERE tenant_id = ? ORDER BY id LIMIT 1', [tenant_id])
      const hash = await generateWerkzeugPBKDF2(password)
      await dbRun(env, 'INSERT INTO users (tenant_id, studio_id, name, email, password_hash, role, permissions, is_active) VALUES (?,?,?,?,?,?,?,1)', [tenant_id, studio?.id ?? null, name, email, hash, 'Receptionist', JSON.stringify(['create_booking','edit_customer'])])
      const user = await dbFirst(env, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email])
      const payload = { user: serializeUser(user), session_timeout: isoPlusMinutes(60) }
      return json({ success: true, data: payload, message: 'Registration successful' }, { status: 201 })
    }
  } catch (e: any) {
    return json({ success: false, message: `Registration failed: ${e?.message || String(e)}` }, { status: 500 })
  }
}


// --- Tenants API ---
async function handleTenants(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const path = url.pathname
  const method = request.method
  // POST /api/tenants
  if (path === '/api/tenants' && method === 'POST') {
    const data = await request.json().catch(() => ({})) as any
    const errors: Record<string, string[]> = {}
    const addErr = (k: string, v: string) => { (errors[k] ||= []).push(v) }
    const tenant_name = (data.tenant_name || '').trim()
    let subdomain = (data.subdomain || '').trim().toLowerCase()
    const admin_name = (data.admin_name || '').trim()
    const admin_email = (data.admin_email || '').trim().toLowerCase()
    const admin_password = data.admin_password || ''
    const plan = data.plan || 'free'
    if (!tenant_name) addErr('tenant_name', 'Tenant name is required')
    if (!subdomain) subdomain = tenant_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20)
    if (!/^[a-z0-9-]+$/.test(subdomain)) addErr('subdomain', 'Subdomain can only contain letters, numbers, and hyphens')
    if (subdomain.length < 3) addErr('subdomain', 'Subdomain must be at least 3 characters long')
    if (!admin_name) addErr('admin_name', 'Admin name is required')
    if (!admin_email) addErr('admin_email', 'Admin email is required')
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(admin_email)) addErr('admin_email', 'Invalid email address')
    if (!admin_password) addErr('admin_password', 'Admin password is required')
    else if (admin_password.length < 8) addErr('admin_password', 'Password must be at least 8 characters')
    const existingEmail = await dbFirst(env, 'SELECT id FROM users WHERE email = ? LIMIT 1', [admin_email])
    if (existingEmail) addErr('admin_email', 'Email already exists')
    const existingSub = await dbFirst(env, 'SELECT id FROM tenants WHERE subdomain = ? LIMIT 1', [subdomain])
    if (existingSub) addErr('subdomain', 'Subdomain already exists')
    if (Object.keys(errors).length) return json({ success: false, errors }, { status: 400 })
    try {
      await dbRun(env, 'INSERT INTO tenants (name, subdomain, plan, is_active) VALUES (?,?,?,1)', [tenant_name, subdomain, plan])
      const tenant = await dbFirst(env, 'SELECT * FROM tenants WHERE subdomain = ? ORDER BY id DESC LIMIT 1', [subdomain])
      await dbRun(env, 'INSERT INTO studios (tenant_id, name) VALUES (?,?)', [tenant.id, `${tenant_name} - Main Studio`])
      const studio = await dbFirst(env, 'SELECT * FROM studios WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [tenant.id])
      const hash = await generateWerkzeugPBKDF2(admin_password)
      await dbRun(env, 'INSERT INTO users (tenant_id, studio_id, name, email, password_hash, role, permissions, is_active) VALUES (?,?,?,?,?,?,?,1)', [tenant.id, studio.id, admin_name, admin_email, hash, 'Studio Manager', JSON.stringify(['view_customers','create_customer','edit_customer','delete_customer','view_bookings','create_booking','edit_booking','cancel_booking','view_staff','create_staff','edit_staff','view_reports','manage_studio'])])
      return json({ success: true, data: { tenant, studio }, message: 'Tenant created successfully' }, { status: 201 })
    } catch (e: any) {
      return json({ success: false, message: `Failed to create tenant: ${e?.message || String(e)}` }, { status: 500 })
    }
  }
  // GET /api/tenants
  if (path === '/api/tenants' && method === 'GET') {
    const user = await getUserFromSession(request, env)
    if (!user || user.role !== 'Admin') return json({ success: false, message: 'Admin access required' }, { status: 403 })
    const rows = await env.DB.prepare('SELECT * FROM tenants').all()
    const data = (rows?.results || []).map((t: any) => ({ id: t.id, name: t.name, subdomain: t.subdomain, plan: t.plan, is_active: !!t.is_active, created_at: t.created_at, settings: t.settings ? JSON.parse(t.settings) : {} }))
    return json({ success: true, data })
  }
  // GET /api/tenants/:id | PUT /api/tenants/:id
  const m = path.match(/^\/api\/tenants\/(\d+)$/)
  if (m) {
    const id = parseInt(m[1], 10)
    const tenant = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [id])
    if (!tenant) return json({ success: false, message: 'Tenant not found' }, { status: 404 })
    const user = await getUserFromSession(request, env)
    if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })
    if (method === 'GET') {
      if (user.role !== 'Admin' && user.tenant_id !== id) return json({ success: false, message: 'Access denied' }, { status: 403 })
      return json({ success: true, data: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain, plan: tenant.plan, is_active: !!tenant.is_active, created_at: tenant.created_at, settings: tenant.settings ? JSON.parse(tenant.settings) : {} } })
    } else if (method === 'PUT') {
      const isGlobalAdmin = user.role === 'Admin'
      const isTenantAdmin = user.role === 'Studio Manager' && user.tenant_id === id
      if (!isGlobalAdmin && !isTenantAdmin) return json({ success: false, message: 'Access denied' }, { status: 403 })
      const body = await request.json().catch(() => ({})) as any
      const updates: string[] = []
      const params: any[] = []
      if (typeof body.name === 'string' && body.name.trim()) { updates.push('name = ?'); params.push(body.name.trim()) }
      if (isGlobalAdmin && 'plan' in body) { updates.push('plan = ?'); params.push(String(body.plan)) }
      if (isGlobalAdmin && 'is_active' in body) { updates.push('is_active = ?'); params.push(body.is_active ? 1 : 0) }
      if (body.settings && typeof body.settings === 'object') { updates.push('settings = ?'); params.push(JSON.stringify({ ...(tenant.settings ? JSON.parse(tenant.settings) : {}), ...body.settings })) }
      if (updates.length === 0) return json({ success: true, data: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain, plan: tenant.plan, is_active: !!tenant.is_active, created_at: tenant.created_at, settings: tenant.settings ? JSON.parse(tenant.settings) : {} }, message: 'No changes' })
      params.push(id)
      await dbRun(env, `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, params)
      const updated = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [id])
      return json({ success: true, data: { id: updated.id, name: updated.name, subdomain: updated.subdomain, plan: updated.plan, is_active: !!updated.is_active, created_at: updated.created_at, settings: updated.settings ? JSON.parse(updated.settings) : {} }, message: 'Tenant updated successfully' })
    }
  }
  return json({ success: false, message: 'API endpoint not found' }, { status: 404 })
}

// --- Customers API ---
async function handleCustomers(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const user = await getUserFromSession(request, env)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })
  const method = request.method
  const path = url.pathname
  // GET /api/customers
  if (path === '/api/customers' && method === 'GET') {
    const qs = url.searchParams
    const search = qs.get('search') || ''
    const sort = qs.get('sort') || 'name'
    const order = (qs.get('order') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const page = Math.max(1, parseInt(qs.get('page') || '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(qs.get('per_page') || '25', 10)))
    const offset = (page - 1) * perPage
    let where = 'WHERE 1=1'
    const params: any[] = []
    if (user.role !== 'Admin' || user.tenant_id) {
      where += ' AND tenant_id = ?'
      params.push(user.tenant_id)
      if (!['Admin', 'Studio Manager'].includes(user.role)) {
        where += ' AND studio_id = ?'
        params.push(user.studio_id)
      }
    }
    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }
    const orderBy = ['name','email','created_at','updated_at'].includes(sort) ? sort : 'name'
    const total = await dbFirst(env, `SELECT COUNT(*) as cnt FROM customers ${where}`, params)
    const rows = await env.DB.prepare(`SELECT * FROM customers ${where} ORDER BY ${orderBy} ${order} LIMIT ? OFFSET ?`).bind(...params, perPage, offset).all()
    const items = (rows?.results || []).map((c: any) => ({ id: c.id, tenant_id: c.tenant_id, studio_id: c.studio_id, name: c.name, email: c.email, phone: c.phone, notes: c.notes || '', created_at: c.created_at, updated_at: c.updated_at }))
    const meta = { total_count: total?.cnt ?? items.length, page, per_page: perPage, has_next: items.length === perPage, has_prev: page > 1 }
    return json({ success: true, data: items, meta })
  }
  // GET /api/customers/:id
  const mGet = path.match(/^\/api\/customers\/(\d+)$/)
  if (mGet && method === 'GET') {
    const id = parseInt(mGet[1], 10)
    const c = await dbFirst(env, 'SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
    if (!c) return json({ success: false, message: 'Customer not found' }, { status: 404 })
    if (!(user.role === 'Admin' && !user.tenant_id)) {
      if (c.tenant_id !== user.tenant_id) return json({ success: false, message: 'Access denied' }, { status: 403 })
      if (!['Admin','Studio Manager'].includes(user.role) && c.studio_id !== user.studio_id) return json({ success: false, message: 'Access denied' }, { status: 403 })
    }
    return json({ success: true, data: c })
  }
  // POST /api/customers
  if (path === '/api/customers' && method === 'POST') {
    if (!user.tenant_id) return json({ success: false, message: 'Invalid user configuration' }, { status: 403 })
    const payload = await request.json().catch(() => ({})) as any
    const errors: Record<string, string[]> = {}
    const addErr = (k: string, v: string) => { (errors[k] ||= []).push(v) }
    const name = (payload.name || '').trim()
    const email = (payload.email || '').trim()
    if (!name) addErr('name', 'Name is required')
    if (!email) addErr('email', 'Email is required')
    else {
      const exist = await dbFirst(env, 'SELECT id FROM customers WHERE tenant_id = ? AND email = ? LIMIT 1', [user.tenant_id, email])
      if (exist) addErr('email', 'Email already exists')
    }
    if (Object.keys(errors).length) return json({ success: false, message: 'Validation failed', errors }, { status: 400 })
    const studioId = ['Admin','Studio Manager'].includes(user.role) ? (payload.studio_id ?? user.studio_id) : user.studio_id
    await dbRun(env, 'INSERT INTO customers (tenant_id, studio_id, name, email, phone, notes) VALUES (?,?,?,?,?,?)', [user.tenant_id, studioId, name, email, payload.phone || null, payload.notes || null])
    const created = await dbFirst(env, 'SELECT * FROM customers WHERE tenant_id = ? AND email = ? ORDER BY id DESC LIMIT 1', [user.tenant_id, email])
    return json({ success: true, data: created, message: 'Customer created successfully' }, { status: 201 })
  }
  // PUT /api/customers/:id
  const mPut = path.match(/^\/api\/customers\/(\d+)$/)
  if (mPut && method === 'PUT') {
    const id = parseInt(mPut[1], 10)
    const c = await dbFirst(env, 'SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
    if (!c) return json({ success: false, message: 'Customer not found' }, { status: 404 })
    if (user.role !== 'Admin') {
      if (c.tenant_id !== user.tenant_id) return json({ success: false, message: 'Forbidden' }, { status: 403 })
      if (!['Admin','Studio Manager'].includes(user.role) && c.studio_id !== user.studio_id) return json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    const payload = await request.json().catch(() => ({})) as any
    const updates: string[] = []
    const params: any[] = []
    if ('name' in payload) { updates.push('name = ?'); params.push(payload.name) }
    if ('email' in payload && payload.email !== c.email) {
      const exists = await dbFirst(env, 'SELECT id FROM customers WHERE tenant_id = ? AND email = ? LIMIT 1', [user.tenant_id, payload.email])
      if (exists) return json({ success: false, message: 'Validation failed', errors: { email: ['Email already exists'] } as any }, { status: 400 })
      updates.push('email = ?'); params.push(payload.email)
    }
    for (const f of ['phone','notes'] as const) if (f in payload) { updates.push(`${f} = ?`); params.push(payload[f]) }
    if (updates.length === 0) return json({ success: true, data: c, message: 'No changes' })
    params.push(id)
    await dbRun(env, `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params)
    const updated = await dbFirst(env, 'SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
    return json({ success: true, data: updated, message: 'Customer updated successfully' })
  }
  // DELETE /api/customers/:id
  const mDel = path.match(/^\/api\/customers\/(\d+)$/)
  if (mDel && method === 'DELETE') {
    const id = parseInt(mDel[1], 10)
    const c = await dbFirst(env, 'SELECT * FROM customers WHERE id = ? LIMIT 1', [id])
    if (!c) return json({ success: false, message: 'Customer not found' }, { status: 404 })
    if (user.role !== 'Admin' && c.studio_id !== user.studio_id) return json({ success: false, message: 'Forbidden' }, { status: 403 })
    await dbRun(env, 'DELETE FROM customers WHERE id = ?', [id])
    return json({ success: true, message: 'Customer deleted successfully' })
  }
  return json({ success: false, message: 'API endpoint not found' }, { status: 404 })
}

// --- Rooms API ---
async function handleRooms(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const user = await getUserFromSession(request, env)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })
  const path = url.pathname
  const method = request.method
  if (path === '/api/rooms' && method === 'GET') {
    const qs = url.searchParams
    const studioId = qs.get('studio_id')
    let where = ''
    const params: any[] = []
    if (user.role !== 'Admin' || user.tenant_id) {
      where += ' WHERE tenant_id = ?'
      params.push(user.tenant_id)
      if (!['Admin','Studio Manager'].includes(user.role)) {
        where += ' AND studio_id = ?'
        params.push(user.studio_id)
      } else if (studioId) {
        where += ' AND studio_id = ?'
        params.push(parseInt(studioId, 10))
      }
    }
    const rows = await env.DB.prepare(`SELECT * FROM rooms${where}`).bind(...params).all()
    const data = (rows?.results || []).map((r: any) => ({ id: r.id, tenant_id: r.tenant_id, studio_id: r.studio_id, name: r.name, capacity: r.capacity, hourly_rate: r.hourly_rate, equipment: r.equipment ? JSON.parse(r.equipment) : [], is_active: !!r.is_active }))
    return json({ success: true, data })
  }
  if (path === '/api/rooms' && method === 'POST') {
    const payload = await request.json().catch(() => ({})) as any
    const equipment = JSON.stringify(payload.equipment || [])
    await dbRun(env, 'INSERT INTO rooms (tenant_id, studio_id, name, capacity, hourly_rate, equipment, is_active) VALUES (?,?,?,?,?,?,1)', [user.tenant_id, payload.studio_id || user.studio_id, payload.name, payload.capacity || 0, payload.hourly_rate || null, equipment])
    const created = await dbFirst(env, 'SELECT * FROM rooms WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [user.tenant_id])
    return json({ success: true, data: created }, { status: 201 })
  }
  const m = path.match(/^\/api\/rooms\/(\d+)$/)
  if (m && (method === 'PUT' || method === 'DELETE')) {
    const id = parseInt(m[1], 10)
    const room = await dbFirst(env, 'SELECT * FROM rooms WHERE id = ? LIMIT 1', [id])
    if (!room) return json({ success: false, message: 'Room not found' }, { status: 404 })
    if (room.tenant_id !== user.tenant_id) return json({ success: false, message: 'Forbidden' }, { status: 403 })
    if (method === 'DELETE') {
      await dbRun(env, 'DELETE FROM rooms WHERE id = ?', [id])
      return json({ success: true, message: 'Room deleted' })
    }
    const payload = await request.json().catch(() => ({})) as any
    const updates: string[] = []
    const params: any[] = []
    for (const f of ['name','capacity','hourly_rate','is_active'] as const) if (f in payload) { updates.push(`${f} = ?`); params.push(payload[f]) }
    if ('equipment' in payload) { updates.push('equipment = ?'); params.push(JSON.stringify(payload.equipment || [])) }
    if (updates.length === 0) return json({ success: true, data: room })
    params.push(id)
    await dbRun(env, `UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`, params)
    const updated = await dbFirst(env, 'SELECT * FROM rooms WHERE id = ? LIMIT 1', [id])
    return json({ success: true, data: updated })
  }
  return json({ success: false, message: 'API endpoint not found' }, { status: 404 })
}

// --- Durable Object for booking conflict serialization ---
export class RoomLock {
  state: any
  env: Env
  constructor(state: any, env: Env) {
    this.state = state
    this.env = env
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/create' && request.method === 'POST') {
      const data = await request.json().catch(() => ({})) as any
      // Overlap check: (start < existing.end) AND (end > existing.start)
      const conflict = await dbFirst(this.env, 'SELECT COUNT(*) as cnt FROM bookings WHERE room_id = ? AND status = ? AND start_time < ? AND end_time > ?', [data.room_id, 'confirmed', data.end_time, data.start_time])
      if ((conflict?.cnt || 0) > 0) {
        return json({ success: false, message: 'Booking conflict' }, { status: 409 })
      }
      await dbRun(this.env, 'INSERT INTO bookings (tenant_id, room_id, customer_id, start_time, end_time, status, notes, total_amount) VALUES (?,?,?,?,?,?,?,?)', [data.tenant_id, data.room_id, data.customer_id, data.start_time, data.end_time, data.status || 'confirmed', data.notes || null, data.total_amount || null])
      const created = await dbFirst(this.env, 'SELECT * FROM bookings WHERE room_id = ? ORDER BY id DESC LIMIT 1', [data.room_id])
      return json({ success: true, data: created }, { status: 201 })
    }
    return json({ success: false, message: 'Not found' }, { status: 404 })
  }
}

// --- Bookings API ---
async function handleBookings(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const user = await getUserFromSession(request, env)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })
  const method = request.method
  if (url.pathname === '/api/bookings' && method === 'GET') {
    const qs = url.searchParams
    const roomId = qs.get('room_id')
    const studioId = qs.get('studio_id')
    const from = qs.get('from')
    const to = qs.get('to')
    let where = 'WHERE tenant_id = ?'
    const params: any[] = [user.tenant_id]
    if (roomId) { where += ' AND room_id = ?'; params.push(parseInt(roomId, 10)) }
    if (studioId) { where += ' AND room_id IN (SELECT id FROM rooms WHERE studio_id = ?)'; params.push(parseInt(studioId, 10)) }
    if (from) { where += ' AND end_time > ?'; params.push(from) }
    if (to) { where += ' AND start_time < ?'; params.push(to) }
    const rows = await env.DB.prepare(`SELECT * FROM bookings ${where} ORDER BY start_time ASC`).bind(...params).all()
    const data = rows?.results || []
    return json({ success: true, data })
  }
  if (url.pathname === '/api/bookings' && method === 'POST') {
    const payload = await request.json().catch(() => ({})) as any
    // Serialize through durable object per-room
    const id = env.ROOM_LOCK.idFromName(String(payload.room_id))
    const stub = env.ROOM_LOCK.get(id)
    const resp = await stub.fetch(new Request('https://do/create', { method: 'POST', body: JSON.stringify({ ...payload, tenant_id: user.tenant_id }), headers: { 'Content-Type': 'application/json' } }))
    return resp
  }
  return json({ success: false, message: 'API endpoint not found' }, { status: 404 })
}

// --- Staff API ---
async function handleStaff(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const user = await getUserFromSession(request, env)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })
  const path = url.pathname
  const method = request.method
  if (path === '/api/staff' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY created_at DESC').bind(user.tenant_id).all()
    const data = (rows?.results || []).map(serializeUser)
    return json({ success: true, data })
  }
  if (path === '/api/staff' && method === 'POST') {
    if (!['Admin','Studio Manager'].includes(user.role)) return json({ success: false, message: 'Forbidden' }, { status: 403 })
    const payload = await request.json().catch(() => ({})) as any
    const hash = await generateWerkzeugPBKDF2(payload.password || 'password')
    await dbRun(env, 'INSERT INTO users (tenant_id, studio_id, name, email, password_hash, role, permissions, is_active) VALUES (?,?,?,?,?,?,?,1)', [user.tenant_id, payload.studio_id || user.studio_id, payload.name, payload.email, hash, payload.role || 'Receptionist', JSON.stringify(payload.permissions || [])])
    const created = await dbFirst(env, 'SELECT * FROM users WHERE tenant_id = ? AND email = ? ORDER BY id DESC LIMIT 1', [user.tenant_id, payload.email])
    return json({ success: true, data: serializeUser(created) }, { status: 201 })
  }
  const m = path.match(/^\/api\/staff\/(\d+)$/)
  if (m && (method === 'PUT' || method === 'DELETE')) {
    const id = parseInt(m[1], 10)
    const target = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [id])
    if (!target || target.tenant_id !== user.tenant_id) return json({ success: false, message: 'Not found' }, { status: 404 })
    if (!['Admin','Studio Manager'].includes(user.role)) return json({ success: false, message: 'Forbidden' }, { status: 403 })
    if (method === 'DELETE') {
      await dbRun(env, 'DELETE FROM users WHERE id = ?', [id])
      return json({ success: true, message: 'Staff deleted' })
    }
    const payload = await request.json().catch(() => ({})) as any
    const updates: string[] = []
    const params: any[] = []
    for (const f of ['name','email','role','studio_id','is_active'] as const) if (f in payload) { updates.push(`${f} = ?`); params.push(payload[f]) }
    if ('permissions' in payload) { updates.push('permissions = ?'); params.push(JSON.stringify(payload.permissions || [])) }
    if (updates.length === 0) return json({ success: true, data: serializeUser(target) })
    params.push(id)
    await dbRun(env, `UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)
    const updated = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [id])
    return json({ success: true, data: serializeUser(updated) })
  }
  return json({ success: false, message: 'API endpoint not found' }, { status: 404 })
}

// --- Reports CSV ---
async function handleReports(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return new Response('DB not bound', { status: 503 })
  const user = await getUserFromSession(request, env)
  if (!user) return new Response('Unauthorized', { status: 401 })
  const headers = new Headers()
  headers.set('Content-Type', 'text/csv; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  if (url.pathname.endsWith('/bookings.csv')) {
    headers.set('Content-Disposition', 'attachment; filename="bookings.csv"')
    const rows = await env.DB.prepare('SELECT * FROM bookings WHERE tenant_id = ? ORDER BY start_time ASC').bind(user.tenant_id).all()
    const lines = ['id,room_id,customer_id,start_time,end_time,status,total_amount']
    for (const b of (rows?.results || [])) {
      lines.push([b.id, b.room_id, b.customer_id, b.start_time, b.end_time, b.status, b.total_amount ?? ''].join(','))
    }
    return new Response(lines.join('\n'), { headers })
  }
  if (url.pathname.endsWith('/revenue.csv')) {
    headers.set('Content-Disposition', 'attachment; filename="revenue.csv"')
    const rows = await env.DB.prepare('SELECT date(start_time) as day, SUM(total_amount) as revenue FROM bookings WHERE tenant_id = ? AND status = ? GROUP BY day ORDER BY day ASC').bind(user.tenant_id, 'confirmed').all()
    const lines = ['date,revenue']
    for (const r of (rows?.results || [])) lines.push([r.day, r.revenue ?? 0].join(','))
    return new Response(lines.join('\n'), { headers })
  }
  return new Response('Not found', { status: 404 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Cloudflare-native API routes (incremental cutover)
    if (url.pathname === '/api/health') {
      return handleHealth()
    }
    if (url.pathname === '/api/readiness') {
      return handleReadiness(env)
    }
  if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env, url)
    }
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      return handleLogout(request)
    }
    if (url.pathname === '/api/session' && request.method === 'GET') {
      return handleSession(request, env)
    }
    if (url.pathname === '/api/register' && request.method === 'POST') {
      return handleRegister(request, env)
    }
    if (url.pathname.startsWith('/api/tenants')) {
      return handleTenants(request, env, url)
    }
    if (url.pathname === '/api/customers' || /^\/api\/customers\//.test(url.pathname)) {
      return handleCustomers(request, env, url)
    }
    if (url.pathname === '/api/rooms' || /^\/api\/rooms\//.test(url.pathname)) {
      return handleRooms(request, env, url)
    }
    if (url.pathname === '/api/bookings' || /^\/api\/bookings\//.test(url.pathname)) {
      return handleBookings(request, env, url)
    }
    if (url.pathname === '/api/staff' || /^\/api\/staff\//.test(url.pathname)) {
      return handleStaff(request, env, url)
    }
    if (url.pathname.startsWith('/api/reports/') && (url.pathname.endsWith('.csv'))) {
      return handleReports(request, env, url)
    }

    // For all other /api/*, return 404 (no proxy)
    if (url.pathname.startsWith('/api/')) {
      return json({ success: false, message: 'API endpoint not found' }, { status: 404 })
    }

    // Serve static assets (SPA fallback)
    const assetResp = await env.ASSETS.fetch(request)
    if (assetResp.status === 404 && request.method === 'GET') {
      const indexUrl = new URL('/index.html', url.origin)
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request))
    }
    return assetResp
  },
}
