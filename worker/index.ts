// Minimal Cloudflare types for TS without external deps
type D1Result<T = unknown> = { results: T[] } | null
type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  first: <T = unknown>() => Promise<T | null>
  run: () => Promise<unknown>
  all: <T = unknown>() => Promise<D1Result<T>>
}
interface D1Database { prepare: (query: string) => D1PreparedStatement }
type DurableObjectId = unknown
type DurableObjectStub = { fetch: (req: Request) => Promise<Response> }
type DurableObjectNamespace = { idFromName: (name: string) => DurableObjectId; get: (id: DurableObjectId) => DurableObjectStub }

type AssetFetcher = {
  fetch: (request: Request) => Promise<Response>
}

// D1Database is available in the Workers runtime types
export interface Env {
  ASSETS: AssetFetcher
  // Bind a D1 database as "DB" in wrangler.toml when ready
  DB?: D1Database
  JWT_SECRET?: string
  NODE_ENV?: string
  ROOM_LOCK: DurableObjectNamespace
}

type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
  meta?: Record<string, unknown>
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

// --- Global Admin Helpers ---
async function ensureAdminTables(env: Env) {
  if (!env.DB) return
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    audience TEXT DEFAULT 'all',
    tenant_id INTEGER NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run()
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE,
    plan TEXT NOT NULL,
    seats INTEGER DEFAULT 1,
    expires_at TEXT NULL,
    tenant_id INTEGER NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run()
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    license_id INTEGER NOT NULL,
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run()
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run()
}

// --- Booking Extensions (schema) ---
async function ensureBookingExtensions(env: Env) {
  if (!env.DB) return
  // Helper to add a column if missing
  async function ensureColumn(table: string, column: string, ddl: string) {
    const info = await env.DB!.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
    const cols = (info?.results || []).map(r => (r as any).name)
    if (!cols.includes(column)) {
      await env.DB!.prepare(`ALTER TABLE ${table} ADD COLUMN ${ddl}`).run()
    }
  }
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS booking_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  )`).run()
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS recurring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    pattern TEXT NOT NULL, -- 'weekly' | 'monthly'
    interval INTEGER DEFAULT 1,
    byweekday TEXT NULL, -- JSON array of 0-6
    bymonthday TEXT NULL, -- JSON array of 1-31
    notes TEXT NULL,
    room_ids TEXT NOT NULL, -- JSON array
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  )`).run()
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  )`).run()
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS time_slot_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    room_type TEXT NULL,
    room_id INTEGER NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    days_of_week TEXT NOT NULL, -- JSON array 0-6
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
  )`).run()
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    title TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  )`).run()
  // Add optional columns
  await ensureColumn('rooms', 'room_type', 'room_type TEXT')
  await ensureColumn('bookings', 'event_id', 'event_id INTEGER NULL')
  await ensureColumn('bookings', 'staff_id', 'staff_id INTEGER NULL')
}

function requireGlobalAdmin(user: { role?: string } | null): string | null {
  if (!user) return 'Unauthorized'
  if (user.role !== 'SuperAdmin') return 'SuperAdmin access required'
  return null
}

async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const user = await getUserFromSession(request, env)
  const err = requireGlobalAdmin(user)
  if (err) return json({ success: false, message: err }, { status: err === 'Unauthorized' ? 401 : 403 })

  const path = url.pathname
  const method = request.method
  await ensureAdminTables(env)
  await ensureBookingExtensions(env)

  // GET /api/admin/summary
  if (path === '/api/admin/summary' && method === 'GET') {
    const tenants = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM tenants')
    const activeTenants = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM tenants WHERE is_active = 1')
    const users = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM users')
    const bookings = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM bookings')
    const revenue = await dbFirst(env, 'SELECT IFNULL(SUM(total_amount),0) as sum FROM bookings WHERE status = ?', ['confirmed'])
    return json({ success: true, data: {
      tenants: tenants?.cnt || 0,
      active_tenants: activeTenants?.cnt || 0,
      users: users?.cnt || 0,
      bookings: bookings?.cnt || 0,
      revenue: revenue?.sum || 0
    } })
  }

  // Aliases to tenant management
  if (path === '/api/admin/tenants' && method === 'GET') {
  const rows = await env.DB.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all()
  const data = (rows?.results || []).map((t) => ({ id: (t as any).id, name: (t as any).name, subdomain: (t as any).subdomain, plan: (t as any).plan, is_active: !!(t as any).is_active, created_at: (t as any).created_at }))
    return json({ success: true, data })
  }
  if (path === '/api/admin/tenants' && method === 'POST') {
    // Proxy to existing creation logic
    return handleTenants(new Request(url.origin + '/api/tenants', { method: 'POST', headers: request.headers, body: await request.clone().text() }), env, new URL(url.origin + '/api/tenants'))
  }

  // Live bookings count per tenant (current active bookings)
  if (path === '/api/admin/tenants/live-bookings' && method === 'GET') {
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const rows = await env.DB.prepare(`SELECT tenant_id, COUNT(*) as cnt
      FROM bookings
      WHERE status = ? AND start_time <= ? AND end_time > ?
      GROUP BY tenant_id`).bind('confirmed', nowIso, nowIso).all()
    return json({ success: true, data: rows?.results || [] })
  }

  // Tenant admins list
  const mAdmins = path.match(/^\/api\/admin\/tenants\/(\d+)\/admins$/)
  if (mAdmins && method === 'GET') {
    const tenantId = parseInt(mAdmins[1], 10)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('per_page') || '25', 10)))
    const offset = (page - 1) * perPage
    const total = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ? AND role = ?', [tenantId, 'Admin'])
    const rows = await env.DB.prepare('SELECT * FROM users WHERE tenant_id = ? AND role = ? ORDER BY created_at ASC LIMIT ? OFFSET ?').bind(tenantId, 'Admin', perPage, offset).all()
    const data = (rows?.results || []).map(serializeUser)
    return json({ success: true, data, meta: { total_count: total?.cnt || data.length, page, per_page: perPage } })
  }
  if (mAdmins && method === 'POST') {
    const tenantId = parseInt(mAdmins[1], 10)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').toLowerCase().trim()
    const password = String(body.password ?? '')
    if (!name || !email || !password) return json({ success: false, message: 'name, email, password required' }, { status: 400 })
    const adminCount = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ? AND role = ?', [tenantId, 'Admin'])
    if ((adminCount?.cnt || 0) >= 2) return json({ success: false, message: 'Tenant already has 2 Admins' }, { status: 400 })
    const tenant = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [tenantId])
    if (!tenant) return json({ success: false, message: 'Tenant not found' }, { status: 404 })
    const studio = await dbFirst(env, 'SELECT * FROM studios WHERE tenant_id = ? ORDER BY id LIMIT 1', [tenantId])
    const hash = await generateWerkzeugPBKDF2(password)
    await dbRun(env, 'INSERT INTO users (tenant_id, studio_id, name, email, password_hash, role, permissions, is_active) VALUES (?,?,?,?,?,?,?,1)', [tenantId, studio?.id ?? null, name, email, hash, 'Admin', JSON.stringify(['view_customers','create_customer','edit_customer','delete_customer','view_bookings','create_booking','edit_booking','cancel_booking','view_staff','create_staff','edit_staff','view_reports','manage_studio'])])
    const created = await dbFirst(env, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email])
    await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, 'create_company_admin', JSON.stringify({ tenant_id: tenantId, user_id: created.id })])
    return json({ success: true, data: serializeUser(created), message: 'Company admin created' }, { status: 201 })
  }

  // Change or delete tenant admin
  const mAdminAction = path.match(/^\/api\/admin\/tenants\/(\d+)\/admins\/(\d+)(?:\/(role))?$/)
  if (mAdminAction) {
    const tenantId = parseInt(mAdminAction[1], 10)
    const targetUserId = parseInt(mAdminAction[2], 10)
    if (method === 'DELETE') {
      const u = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [targetUserId])
      if (!u || u.tenant_id !== tenantId || u.role !== 'Admin') return json({ success: false, message: 'Admin not found' }, { status: 404 })
      // Ensure not violating last admin? Requirement allows 0–2 admins, so delete allowed
      await dbRun(env, 'DELETE FROM users WHERE id = ?', [targetUserId])
      await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, 'delete_company_admin', JSON.stringify({ tenant_id: tenantId, user_id: targetUserId })])
      return json({ success: true, message: 'Company admin deleted' })
    }
    if (method === 'POST' && mAdminAction[3] === 'role') {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
      const newRole = String(body.role ?? '').trim()
      const allowed = ['Admin','Studio Manager','Receptionist','Staff/Instructor']
      if (!allowed.includes(newRole)) return json({ success: false, message: 'Invalid role' }, { status: 400 })
      const u = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [targetUserId])
      if (!u || u.tenant_id !== tenantId) return json({ success: false, message: 'User not found' }, { status: 404 })
      if (newRole === 'Admin') {
        const adminCount = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ? AND role = ?', [tenantId, 'Admin'])
        if ((adminCount?.cnt || 0) >= 2) return json({ success: false, message: 'Tenant already has 2 Admins' }, { status: 400 })
      }
      // Prevent demoting the only Admin if business wants at least 0 – allowed per requirement
      await dbRun(env, 'UPDATE users SET role = ? WHERE id = ?', [newRole, targetUserId])
      await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, 'change_company_admin_role', JSON.stringify({ tenant_id: tenantId, user_id: targetUserId, role: newRole })])
      const updated = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [targetUserId])
      return json({ success: true, data: serializeUser(updated), message: 'Role updated' })
    }
  }

  // Create arbitrary user in tenant
  const mUsersCreate = path.match(/^\/api\/admin\/tenants\/(\d+)\/users$/)
  if (mUsersCreate && method === 'GET') {
    const tenantId = parseInt(mUsersCreate[1], 10)
    const qs = url.searchParams
    const search = (qs.get('search') || '').trim()
    const page = Math.max(1, parseInt(qs.get('page') || '1', 10))
    const perPage = Math.min(100, Math.max(1, parseInt(qs.get('per_page') || '25', 10)))
    const offset = (page - 1) * perPage
    let where = 'WHERE tenant_id = ?'
  const params: unknown[] = [tenantId]
    if (search) { where += ' AND (name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
    const total = await dbFirst(env, `SELECT COUNT(*) as cnt FROM users ${where}`, params)
    const rows = await env.DB.prepare(`SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...params, perPage, offset).all()
    const data = (rows?.results || []).map(serializeUser)
    return json({ success: true, data, meta: { total_count: total?.cnt || data.length, page, per_page: perPage } })
  }
  if (mUsersCreate && method === 'POST') {
    const tenantId = parseInt(mUsersCreate[1], 10)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').toLowerCase().trim()
    const password = String(body.password ?? '')
    const role = String(body.role ?? 'Receptionist')
    const allowedRoles = ['Admin','Studio Manager','Staff/Instructor','Receptionist']
    if (!name || !email || !password) return json({ success: false, message: 'name, email, password required' }, { status: 400 })
    if (!allowedRoles.includes(role)) return json({ success: false, message: 'Invalid role' }, { status: 400 })
    if (role === 'Admin') {
      const adminCount = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ? AND role = ?', [tenantId, 'Admin'])
      if ((adminCount?.cnt || 0) >= 2) return json({ success: false, message: 'Tenant already has 2 Admins' }, { status: 400 })
    }
    const tenant = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [tenantId])
    if (!tenant) return json({ success: false, message: 'Tenant not found' }, { status: 404 })
    const studio = await dbFirst(env, 'SELECT * FROM studios WHERE tenant_id = ? ORDER BY id LIMIT 1', [tenantId])
    const hash = await generateWerkzeugPBKDF2(password)
    await dbRun(env, 'INSERT INTO users (tenant_id, studio_id, name, email, password_hash, role, permissions, is_active) VALUES (?,?,?,?,?,?,?,1)', [tenantId, studio?.id ?? null, name, email, hash, role, JSON.stringify([])])
    const created = await dbFirst(env, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email])
    await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, 'admin_create_user', JSON.stringify({ tenant_id: tenantId, user_id: created.id, role })])
    return json({ success: true, data: serializeUser(created), message: 'User created' }, { status: 201 })
  }

  // Suspend/enable tenant
  const mTenantAction = path.match(/^\/api\/admin\/tenants\/(\d+)\/(suspend|enable)$/)
  if (mTenantAction && method === 'POST') {
    const id = parseInt(mTenantAction[1], 10)
    const action = mTenantAction[2]
    const t = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [id])
    if (!t) return json({ success: false, message: 'Tenant not found' }, { status: 404 })
    const active = action === 'enable' ? 1 : 0
    await dbRun(env, 'UPDATE tenants SET is_active = ? WHERE id = ?', [active, id])
    await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, action === 'enable' ? 'enable_tenant' : 'suspend_tenant', JSON.stringify({ tenant_id: id })])
    return json({ success: true, message: `Tenant ${action}d` })
  }

  // Delete tenant (cascade)
  const mTenantDelete = path.match(/^\/api\/admin\/tenants\/(\d+)$/)
  if (mTenantDelete && method === 'DELETE') {
    const id = parseInt(mTenantDelete[1], 10)
    const t = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [id])
    if (!t) return json({ success: false, message: 'Tenant not found' }, { status: 404 })
    // Cascade delete related data
    await dbRun(env, 'DELETE FROM bookings WHERE tenant_id = ?', [id])
    await dbRun(env, 'DELETE FROM rooms WHERE tenant_id = ?', [id])
    await dbRun(env, 'DELETE FROM customers WHERE tenant_id = ?', [id])
    await dbRun(env, 'DELETE FROM studios WHERE tenant_id = ?', [id])
    await dbRun(env, 'DELETE FROM users WHERE tenant_id = ?', [id])
    await dbRun(env, 'DELETE FROM licenses WHERE tenant_id = ?', [id])
    await dbRun(env, 'DELETE FROM tenants WHERE id = ?', [id])
    await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, 'delete_tenant', JSON.stringify({ tenant_id: id })])
    return json({ success: true, message: 'Tenant deleted' })
  }

  // POST /api/admin/users/move
  if (path === '/api/admin/users/move' && method === 'POST') {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const userId = parseInt(String(body.user_id), 10)
    const targetTenantId = parseInt(String(body.target_tenant_id), 10)
    const targetStudioId = body.target_studio_id != null ? parseInt(String(body.target_studio_id), 10) : null
    if (!Number.isFinite(userId) || !Number.isFinite(targetTenantId)) return json({ success: false, message: 'user_id and target_tenant_id are required' }, { status: 400 })
    const targetTenant = await dbFirst(env, 'SELECT * FROM tenants WHERE id = ? LIMIT 1', [targetTenantId])
    if (!targetTenant) return json({ success: false, message: 'Target tenant not found' }, { status: 404 })
    let studioId = targetStudioId
    if (!studioId) {
      const studio = await dbFirst(env, 'SELECT * FROM studios WHERE tenant_id = ? ORDER BY id LIMIT 1', [targetTenantId])
      if (!studio) {
        await dbRun(env, 'INSERT INTO studios (tenant_id, name) VALUES (?, ?)', [targetTenantId, `${targetTenant.name} - Main Studio`])
        const created = await dbFirst(env, 'SELECT * FROM studios WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [targetTenantId])
        studioId = created.id
      } else {
        studioId = studio.id
      }
    }
  await dbRun(env, 'UPDATE users SET tenant_id = ?, studio_id = ? WHERE id = ?', [targetTenantId, studioId, userId])
  await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, 'move_user', JSON.stringify({ user_id: userId, target_tenant_id: targetTenantId, target_studio_id: studioId })])
    const updated = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [userId])
    return json({ success: true, data: serializeUser(updated), message: 'User moved' })
  }

  // POST /api/admin/users/role { user_id, role }
  if (path === '/api/admin/users/role' && method === 'POST') {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const targetUserId = parseInt(String(body.user_id), 10)
    const newRole = String(body.role ?? '').trim()
    if (!Number.isFinite(targetUserId) || !newRole) return json({ success: false, message: 'user_id and role are required' }, { status: 400 })
    const allowedRoles = ['SuperAdmin','Admin','Studio Manager','Staff/Instructor','Receptionist']
    if (!allowedRoles.includes(newRole)) return json({ success: false, message: 'Invalid role' }, { status: 400 })
    const target = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [targetUserId])
    if (!target) return json({ success: false, message: 'User not found' }, { status: 404 })
    // Safeguard: Prevent removing last remaining SuperAdmin
    if (target.role === 'SuperAdmin' && newRole !== 'SuperAdmin') {
      const count = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM users WHERE role = ? LIMIT 1', ['SuperAdmin'])
      if ((count?.cnt || 0) <= 1) {
        return json({ success: false, message: 'Cannot remove the last SuperAdmin' }, { status: 400 })
      }
    }
    await dbRun(env, 'UPDATE users SET role = ? WHERE id = ?', [newRole, targetUserId])
    const updated = await dbFirst(env, 'SELECT * FROM users WHERE id = ? LIMIT 1', [targetUserId])
    const action = newRole === 'SuperAdmin' ? 'grant_superadmin' : (target.role === 'SuperAdmin' ? 'revoke_superadmin' : 'change_role')
    await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, action, JSON.stringify({ user_id: targetUserId, from: target.role, to: newRole })])
    return json({ success: true, data: serializeUser(updated), message: 'Role updated' })
  }

  // Messages
  if (path === '/api/admin/messages' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 200').all()
    return json({ success: true, data: rows?.results || [] })
  }
  if (path === '/api/admin/messages' && method === 'POST') {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const title = String(body.title ?? '').trim()
    const message = String(body.body ?? '').trim()
    const tenantId = body.tenant_id != null ? parseInt(String(body.tenant_id), 10) : null
    if (!title || !message) return json({ success: false, message: 'title and body are required' }, { status: 400 })
    await dbRun(env, 'INSERT INTO announcements (title, body, audience, tenant_id) VALUES (?,?,?,?)', [title, message, tenantId ? 'tenant' : 'all', tenantId])
    const created = await dbFirst(env, 'SELECT * FROM announcements ORDER BY id DESC LIMIT 1')
    return json({ success: true, data: created, message: 'Message broadcasted' }, { status: 201 })
  }

  // Licenses
  if (path === '/api/admin/licenses' && method === 'GET') {
  const rows = await env.DB.prepare('SELECT * FROM licenses ORDER BY created_at DESC').all()
    return json({ success: true, data: rows?.results || [] })
  }
  if (path === '/api/admin/licenses' && method === 'POST') {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const plan = String(body.plan ?? 'basic')
    const seats = Number(body.seats ?? 1)
    const expires = body.expires_at != null ? String(body.expires_at) : null
    const tenantId = body.tenant_id != null ? parseInt(String(body.tenant_id), 10) : null
    const key = (body.key ? String(body.key) : '') || `LIC-${Math.random().toString(36).slice(2,8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
    await dbRun(env, 'INSERT INTO licenses (key, plan, seats, expires_at, tenant_id, is_active) VALUES (?,?,?,?,?,1)', [key, plan, seats, expires, tenantId])
    const created = await dbFirst(env, 'SELECT * FROM licenses WHERE key = ? LIMIT 1', [key])
    return json({ success: true, data: created, message: 'License created' }, { status: 201 })
  }
  if (path === '/api/admin/licenses/assign' && method === 'POST') {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const licenseId = parseInt(String(body.license_id), 10)
    if (!Number.isFinite(licenseId)) return json({ success: false, message: 'license_id required' }, { status: 400 })
    if (body.user_id != null) {
      const userId = parseInt(String(body.user_id), 10)
      if (!Number.isFinite(userId)) return json({ success: false, message: 'user_id invalid' }, { status: 400 })
  await dbRun(env, 'INSERT INTO user_licenses (user_id, license_id) VALUES (?,?)', [userId, licenseId])
  await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, 'assign_license_user', JSON.stringify({ license_id: licenseId, user_id: userId })])
      return json({ success: true, message: 'License assigned to user' })
    }
    if (body.tenant_id != null) {
      const tenantId = parseInt(String(body.tenant_id), 10)
      if (!Number.isFinite(tenantId)) return json({ success: false, message: 'tenant_id invalid' }, { status: 400 })
  await dbRun(env, 'UPDATE licenses SET tenant_id = ? WHERE id = ?', [tenantId, licenseId])
  await dbRun(env, 'INSERT INTO audit_logs (actor_user_id, action, details) VALUES (?,?,?)', [user.id, 'assign_license_tenant', JSON.stringify({ license_id: licenseId, tenant_id: tenantId })])
      return json({ success: true, message: 'License assigned to tenant' })
    }
    return json({ success: false, message: 'Either user_id or tenant_id is required' }, { status: 400 })
  }

  // Platform-wide CSV reports
  if (path === '/api/admin/reports/bookings.csv' && method === 'GET') {
    const headers = new Headers({ 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="platform-bookings.csv"' })
  const rows = await env.DB.prepare('SELECT * FROM bookings ORDER BY start_time ASC').all()
  const lines = ['id,tenant_id,room_id,customer_id,start_time,end_time,status,total_amount']
  for (const b of ((rows?.results as any[]) || [])) lines.push([b.id, b.tenant_id, b.room_id, b.customer_id, b.start_time, b.end_time, b.status, b.total_amount ?? ''].join(','))
    return new Response(lines.join('\n'), { headers })
  }
  if (path === '/api/admin/reports/revenue.csv' && method === 'GET') {
    const headers = new Headers({ 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="platform-revenue.csv"' })
  const rows = await env.DB.prepare('SELECT date(start_time) as day, SUM(total_amount) as revenue FROM bookings WHERE status = ? GROUP BY day ORDER BY day ASC').bind('confirmed').all()
    const lines = ['date,revenue']
  for (const r of ((rows?.results as any[]) || [])) lines.push([r.day, r.revenue ?? 0].join(','))
    return new Response(lines.join('\n'), { headers })
  }

  return json({ success: false, message: 'Admin endpoint not found' }, { status: 404 })
}

// --- Tenant resolution from Host or dev override ---
async function resolveTenantFromRequest(env: Env, request: Request): Promise<Record<string, unknown> | null> {
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

async function handleAnnouncements(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const user = await getUserFromSession(request, env)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })
  // Ensure table exists (shared with admin)
  await ensureAdminTables(env)
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)))
  let rows: any
  if (user.tenant_id) {
    rows = await env.DB
      .prepare('SELECT * FROM announcements WHERE audience = ? OR (audience = ? AND tenant_id = ?) ORDER BY created_at DESC LIMIT ?')
      .bind('all', 'tenant', user.tenant_id, limit)
      .all()
  } else {
    // No tenant context (e.g., SuperAdmin browsing app) – show global only
    rows = await env.DB
      .prepare('SELECT * FROM announcements WHERE audience = ? ORDER BY created_at DESC LIMIT ?')
      .bind('all', limit)
      .all()
  }
  return json({ success: true, data: rows?.results || [] })
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
async function dbFirst<T = any>(env: Env, sql: string, params: unknown[] = []): Promise<T | null> {
  const db = env.DB as D1Database
  let stmt: D1PreparedStatement = db.prepare(sql)
  if (params.length) {
    stmt = stmt.bind(...params)
  }
  return (stmt.first ? await stmt.first<T>() : null)
}

async function dbRun(env: Env, sql: string, params: unknown[] = []): Promise<void> {
  const db = env.DB as D1Database
  let stmt: D1PreparedStatement = db.prepare(sql)
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
  await dbRun(env, 'INSERT INTO users (tenant_id, studio_id, name, email, password_hash, role, permissions, is_active) VALUES (?,?,?,?,?,?,?,1)', [tenant.id, studio.id, admin_name, admin_email, hash, 'Admin', JSON.stringify(['view_customers','create_customer','edit_customer','delete_customer','view_bookings','create_booking','edit_booking','cancel_booking','view_staff','create_staff','edit_staff','view_reports','manage_studio'])])
      return json({ success: true, data: { tenant, studio }, message: 'Tenant created successfully' }, { status: 201 })
    } catch (e: any) {
      return json({ success: false, message: `Failed to create tenant: ${e?.message || String(e)}` }, { status: 500 })
    }
  }
  // GET /api/tenants
  if (path === '/api/tenants' && method === 'GET') {
    const user = await getUserFromSession(request, env)
    if (!user || user.role !== 'SuperAdmin') return json({ success: false, message: 'SuperAdmin access required' }, { status: 403 })
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
      if (user.role !== 'SuperAdmin' && user.tenant_id !== id) return json({ success: false, message: 'Access denied' }, { status: 403 })
      return json({ success: true, data: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain, plan: tenant.plan, is_active: !!tenant.is_active, created_at: tenant.created_at, settings: tenant.settings ? JSON.parse(tenant.settings) : {} } })
    } else if (method === 'PUT') {
      const isGlobalAdmin = user.role === 'SuperAdmin'
      const isTenantAdmin = (user.role === 'Admin' || user.role === 'Studio Manager') && user.tenant_id === id
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
  if (user.role !== 'SuperAdmin' || user.tenant_id) {
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
  if (!(user.role === 'SuperAdmin' && !user.tenant_id)) {
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
  if (user.role !== 'SuperAdmin' || user.tenant_id) {
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
      const hasEvent = typeof data.event_id !== 'undefined' && data.event_id !== null
      const hasStaff = typeof data.staff_id !== 'undefined' && data.staff_id !== null
      if (hasEvent && hasStaff) {
        await dbRun(this.env, 'INSERT INTO bookings (tenant_id, room_id, customer_id, start_time, end_time, status, notes, total_amount, event_id, staff_id) VALUES (?,?,?,?,?,?,?,?,?,?)', [data.tenant_id, data.room_id, data.customer_id, data.start_time, data.end_time, data.status || 'confirmed', data.notes || null, data.total_amount || null, data.event_id, data.staff_id])
      } else if (hasEvent) {
        await dbRun(this.env, 'INSERT INTO bookings (tenant_id, room_id, customer_id, start_time, end_time, status, notes, total_amount, event_id) VALUES (?,?,?,?,?,?,?,?,?)', [data.tenant_id, data.room_id, data.customer_id, data.start_time, data.end_time, data.status || 'confirmed', data.notes || null, data.total_amount || null, data.event_id])
      } else if (hasStaff) {
        await dbRun(this.env, 'INSERT INTO bookings (tenant_id, room_id, customer_id, start_time, end_time, status, notes, total_amount, staff_id) VALUES (?,?,?,?,?,?,?,?,?)', [data.tenant_id, data.room_id, data.customer_id, data.start_time, data.end_time, data.status || 'confirmed', data.notes || null, data.total_amount || null, data.staff_id])
      } else {
        await dbRun(this.env, 'INSERT INTO bookings (tenant_id, room_id, customer_id, start_time, end_time, status, notes, total_amount) VALUES (?,?,?,?,?,?,?,?)', [data.tenant_id, data.room_id, data.customer_id, data.start_time, data.end_time, data.status || 'confirmed', data.notes || null, data.total_amount || null])
      }
      const created = await dbFirst(this.env, 'SELECT * FROM bookings WHERE room_id = ? AND start_time = ? AND end_time = ? ORDER BY id DESC LIMIT 1', [data.room_id, data.start_time, data.end_time])
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
  await ensureBookingExtensions(env)
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
  // Multi-room booking creation
  if (url.pathname === '/api/bookings/multi' && method === 'POST') {
    const payload = await request.json().catch(() => ({})) as Record<string, unknown>
    const roomIds = Array.isArray((payload as any).room_ids) ? ((payload as any).room_ids as unknown[]).map(n => Number(n)).filter(n => Number.isFinite(n)) : []
    const customerId = Number((payload as any).customer_id)
    const start = String((payload as any).start_time || '')
    const end = String((payload as any).end_time || '')
    const notes = typeof (payload as any).notes === 'string' ? String((payload as any).notes) : null
    if (!(roomIds.length && Number.isFinite(customerId) && start && end)) return json({ success: false, message: 'Invalid payload' }, { status: 400 })
    // Create an event
    await dbRun(env, 'INSERT INTO events (tenant_id, title, notes) VALUES (?,?,?)', [user.tenant_id, (payload as any).title || null, notes])
    const evt = await dbFirst(env, 'SELECT id FROM events WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [user.tenant_id])
    const eventId = evt?.id
    const createdIds: number[] = []
    for (const rid of roomIds) {
      const id = env.ROOM_LOCK.idFromName(String(rid))
      const stub = env.ROOM_LOCK.get(id)
      const resp = await stub.fetch(new Request('https://do/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: user.tenant_id, room_id: rid, customer_id: customerId, start_time: start, end_time: end, status: 'confirmed', notes, event_id: eventId }) }))
      if (!resp.ok) {
        // Rollback previous creates
        for (const bid of createdIds) { await dbRun(env, 'DELETE FROM bookings WHERE id = ?', [bid]) }
        if (eventId) await dbRun(env, 'DELETE FROM events WHERE id = ?', [eventId])
        const body = await resp.json().catch(() => ({}))
        return json({ success: false, message: body?.message || 'Multi-room conflict' }, { status: resp.status })
      }
      const body = await resp.json().catch(() => ({}))
      const bid = body?.data?.id
      if (bid) createdIds.push(bid)
    }
    const rows = await env.DB.prepare('SELECT * FROM bookings WHERE id IN (' + createdIds.map(() => '?').join(',') + ')').bind(...createdIds).all()
    return json({ success: true, data: rows?.results || [] }, { status: 201 })
  }
  // Recurring bookings creation
  if (url.pathname === '/api/bookings/recurring' && method === 'POST') {
    const p = await request.json().catch(() => ({})) as Record<string, unknown>
    const pattern = String((p as any).pattern || '')
    const interval = Number((p as any).interval || 1)
    const startDate = String((p as any).start_date || '')
    const endDate = String((p as any).end_date || '')
    const startTime = String((p as any).start_time || '')
    const endTime = String((p as any).end_time || '')
    const customerId = Number((p as any).customer_id)
    const roomIds = Array.isArray((p as any).room_ids) ? ((p as any).room_ids as unknown[]).map(n => Number(n)).filter(n => Number.isFinite(n)) : (Number.isFinite((p as any).room_id) ? [Number((p as any).room_id)] : [])
    const notes = typeof (p as any).notes === 'string' ? String((p as any).notes) : null
    if (!(pattern && startDate && startTime && endTime && roomIds.length && Number.isFinite(customerId))) return json({ success: false, message: 'Invalid payload' }, { status: 400 })
    // Save rule
    await dbRun(env, 'INSERT INTO recurring_rules (tenant_id, customer_id, start_date, end_date, start_time, end_time, pattern, interval, byweekday, bymonthday, notes, room_ids, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,? ,?)', [user.tenant_id, customerId, startDate, endDate || null, startTime, endTime, pattern, interval, JSON.stringify((p as any).byweekday || null), JSON.stringify((p as any).bymonthday || null), notes, JSON.stringify(roomIds), 'active'])
    // Generate occurrences (bounded to 26 weeks/months to avoid runaway)
  const occ: Array<{ start: string; end: string }> = []
  const toISO = (dateStr: string, t: string) => new Date(`${dateStr}T${t}:00`).toISOString()
  const addDays = (d: Date, days: number) => { const x = new Date(d); x.setDate(x.getDate() + days); return x }
  const fmt = (d: Date) => d.toISOString().slice(0,10)
    const until = endDate ? new Date(`${endDate}T00:00:00`) : null
    const startD = new Date(`${startDate}T00:00:00`)
    if (pattern === 'weekly') {
      const weekdays: number[] = Array.isArray((p as any).byweekday) ? (p as any).byweekday as number[] : [startD.getDay()]
  let cursor = new Date(startD)
      let iterations = 0
      while ((!until || cursor <= until) && iterations < 182) { // ~26 weeks if daily check
        for (const wd of weekdays) {
          const day = new Date(cursor)
          const diff = (wd - day.getDay() + 7) % 7
          const target = addDays(day, diff)
          const ds = fmt(target)
          const s = toISO(ds, startTime)
          const e = toISO(ds, endTime)
          if (!until || target <= until) occ.push({ start: s, end: e })
        }
        cursor = addDays(cursor, 7 * Math.max(1, interval))
        iterations++
      }
    } else if (pattern === 'monthly') {
  const mdays: number[] = Array.isArray((p as any).bymonthday) ? (p as any).bymonthday as number[] : [startD.getDate()]
  let cursor = new Date(startD)
  let iterations = 0
  while ((!until || cursor <= until) && iterations < 24) { // up to 24 months
        for (const mday of mdays) {
          const monthStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
          const target = new Date(monthStart)
          target.setUTCDate(Math.max(1, Math.min(mday, 28)))
          const ds = fmt(target)
          const s = toISO(ds, startTime)
          const e = toISO(ds, endTime)
          if (!until || target <= until) occ.push({ start: s, end: e })
        }
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + Math.max(1, interval), cursor.getUTCDate()))
        iterations++
      }
    } else {
      return json({ success: false, message: 'Unsupported pattern' }, { status: 400 })
    }
    const created: any[] = []
    for (const { start, end } of occ) {
      for (const rid of roomIds) {
        const id = env.ROOM_LOCK.idFromName(String(rid))
        const stub = env.ROOM_LOCK.get(id)
        const resp = await stub.fetch(new Request('https://do/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: user.tenant_id, room_id: rid, customer_id: customerId, start_time: start, end_time: end, status: 'confirmed', notes }) }))
        if (resp.ok) {
          const body = await resp.json().catch(() => ({}))
          if (body?.data) created.push(body.data)
        }
      }
    }
    return json({ success: true, data: created }, { status: 201 })
  }
  if (url.pathname === '/api/bookings' && method === 'POST') {
    const payload = await request.json().catch(() => ({})) as any
    // Serialize through durable object per-room
    const id = env.ROOM_LOCK.idFromName(String(payload.room_id))
    const stub = env.ROOM_LOCK.get(id)
    const resp = await stub.fetch(new Request('https://do/create', { method: 'POST', body: JSON.stringify({ ...payload, tenant_id: user.tenant_id }), headers: { 'Content-Type': 'application/json' } }))
    return resp
  }
  // PUT /api/bookings/:id (update time/status/notes/staff)
  const mPut = url.pathname.match(/^\/api\/bookings\/(\d+)$/)
  if (mPut && method === 'PUT') {
    const id = parseInt(mPut[1], 10)
    const existing = await dbFirst(env, 'SELECT * FROM bookings WHERE id = ? LIMIT 1', [id])
    if (!existing) return json({ success: false, message: 'Booking not found' }, { status: 404 })
    if (existing.tenant_id !== user.tenant_id) return json({ success: false, message: 'Forbidden' }, { status: 403 })
    const payload = await request.json().catch(() => ({})) as any
    const updates: string[] = []
    const params: any[] = []
    const newStart = payload.start_time ? String(payload.start_time) : null
    const newEnd = payload.end_time ? String(payload.end_time) : null
    const newStatus = payload.status ? String(payload.status) : null
  if (newStart) { updates.push('start_time = ?'); params.push(newStart) }
  if (newEnd) { updates.push('end_time = ?'); params.push(newEnd) }
  if (typeof payload.notes !== 'undefined') { updates.push('notes = ?'); params.push(payload.notes || null) }
    if (newStatus) { updates.push('status = ?'); params.push(newStatus) }
  if (typeof payload.total_amount !== 'undefined') { updates.push('total_amount = ?'); params.push(payload.total_amount ?? null) }
  if (typeof payload.staff_id !== 'undefined') { updates.push('staff_id = ?'); params.push(payload.staff_id ?? null) }
    if (updates.length === 0) {
      return json({ success: true, data: existing, message: 'No changes' })
    }
    // Conflict check when updating times for confirmed bookings
    if ((newStart || newEnd) && (newStatus ? newStatus === 'confirmed' : existing.status === 'confirmed')) {
      const startToCheck = newStart || existing.start_time
      const endToCheck = newEnd || existing.end_time
      const conflict = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM bookings WHERE room_id = ? AND status = ? AND id != ? AND start_time < ? AND end_time > ?', [existing.room_id, 'confirmed', id, endToCheck, startToCheck])
      if ((conflict?.cnt || 0) > 0) {
        return json({ success: false, message: 'Booking conflict' }, { status: 409 })
      }
    }
    params.push(id)
    await dbRun(env, `UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`, params)
    const updated = await dbFirst(env, 'SELECT * FROM bookings WHERE id = ? LIMIT 1', [id])
    return json({ success: true, data: updated, message: 'Booking updated' })
  }
  // DELETE /api/bookings/:id (hard delete, optional)
  const mDel = url.pathname.match(/^\/api\/bookings\/(\d+)$/)
  if (mDel && method === 'DELETE') {
    const id = parseInt(mDel[1], 10)
    const existing = await dbFirst(env, 'SELECT * FROM bookings WHERE id = ? LIMIT 1', [id])
    if (!existing) return json({ success: false, message: 'Booking not found' }, { status: 404 })
    if (existing.tenant_id !== user.tenant_id) return json({ success: false, message: 'Forbidden' }, { status: 403 })
    await dbRun(env, 'DELETE FROM bookings WHERE id = ?', [id])
    return json({ success: true, message: 'Booking deleted' })
  }
  // Booking templates CRUD
  if (url.pathname === '/api/booking-templates' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM booking_templates WHERE tenant_id = ? ORDER BY created_at DESC').bind(user.tenant_id).all()
    return json({ success: true, data: rows?.results || [] })
  }
  if (url.pathname === '/api/booking-templates' && method === 'POST') {
    const p = await request.json().catch(() => ({})) as Record<string, unknown>
    const name = String((p as any).name || '')
    const payload = JSON.stringify((p as any).payload || {})
    if (!name) return json({ success: false, message: 'Name required' }, { status: 400 })
    await dbRun(env, 'INSERT INTO booking_templates (tenant_id, name, payload) VALUES (?,?,?)', [user.tenant_id, name, payload])
    const row = await dbFirst(env, 'SELECT * FROM booking_templates WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [user.tenant_id])
    return json({ success: true, data: row }, { status: 201 })
  }
  const mTplDel = url.pathname.match(/^\/api\/booking-templates\/(\d+)$/)
  if (mTplDel && method === 'DELETE') {
    await dbRun(env, 'DELETE FROM booking_templates WHERE tenant_id = ? AND id = ?', [user.tenant_id, Number(mTplDel[1])])
    return json({ success: true, message: 'Deleted' })
  }
  // Waitlist
  if (url.pathname === '/api/waitlist' && method === 'GET') {
    const qs = url.searchParams
    const roomId = qs.get('room_id')
    const rows = await env.DB.prepare('SELECT * FROM waitlist WHERE tenant_id = ? ' + (roomId ? 'AND room_id = ? ' : '') + 'ORDER BY created_at ASC').bind(...(roomId ? [user.tenant_id, Number(roomId)] : [user.tenant_id])).all()
    return json({ success: true, data: rows?.results || [] })
  }
  if (url.pathname === '/api/waitlist' && method === 'POST') {
    const p = await request.json().catch(() => ({})) as Record<string, unknown>
    const roomId = Number((p as any).room_id)
    const customerId = Number((p as any).customer_id)
    const date = String((p as any).date || '')
    const start = String((p as any).start_time || '')
    const end = String((p as any).end_time || '')
    if (!(Number.isFinite(roomId) && Number.isFinite(customerId) && date && start && end)) return json({ success: false, message: 'Invalid payload' }, { status: 400 })
    await dbRun(env, 'INSERT INTO waitlist (tenant_id, room_id, date, start_time, end_time, customer_id, status) VALUES (?,?,?,?,?,?,?)', [user.tenant_id, roomId, date, start, end, customerId, 'waiting'])
    const row = await dbFirst(env, 'SELECT * FROM waitlist WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [user.tenant_id])
    return json({ success: true, data: row }, { status: 201 })
  }
  // Time slot templates
  if (url.pathname === '/api/time-slots' && method === 'GET') {
    const qs = url.searchParams
    const roomType = qs.get('room_type')
    const roomId = qs.get('room_id')
    let where = 'WHERE tenant_id = ?'
    const params: unknown[] = [user.tenant_id]
    if (roomType) { where += ' AND room_type = ?'; params.push(roomType) }
    if (roomId) { where += ' AND room_id = ?'; params.push(Number(roomId)) }
    const rows = await env.DB.prepare(`SELECT * FROM time_slot_templates ${where} ORDER BY created_at DESC`).bind(...params).all()
    return json({ success: true, data: rows?.results || [] })
  }
  if (url.pathname === '/api/time-slots' && method === 'POST') {
    const p = await request.json().catch(() => ({})) as Record<string, unknown>
    const label = String((p as any).label || '')
    const start = String((p as any).start_time || '')
    const end = String((p as any).end_time || '')
    const days = Array.isArray((p as any).days_of_week) ? (p as any).days_of_week : []
    const roomType = (p as any).room_type ? String((p as any).room_type) : null
    const roomId = Number.isFinite((p as any).room_id) ? Number((p as any).room_id) : null
    if (!(label && start && end && Array.isArray(days))) return json({ success: false, message: 'Invalid payload' }, { status: 400 })
    await dbRun(env, 'INSERT INTO time_slot_templates (tenant_id, label, room_type, room_id, start_time, end_time, days_of_week, active) VALUES (?,?,?,?,?,?,?,1)', [user.tenant_id, label, roomType, roomId, start, end, JSON.stringify(days)])
    const row = await dbFirst(env, 'SELECT * FROM time_slot_templates WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [user.tenant_id])
    return json({ success: true, data: row }, { status: 201 })
  }
  const mTsDel = url.pathname.match(/^\/api\/time-slots\/(\d+)$/)
  if (mTsDel && method === 'DELETE') {
    await dbRun(env, 'DELETE FROM time_slot_templates WHERE tenant_id = ? AND id = ?', [user.tenant_id, Number(mTsDel[1])])
    return json({ success: true, message: 'Deleted' })
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
  const searchParams = url.searchParams
  const from = searchParams.get('from') || new Date(Date.now() - 29*24*3600*1000).toISOString()
  const to = searchParams.get('to') || new Date().toISOString()
  if (url.pathname.endsWith('/bookings.csv')) {
    headers.set('Content-Disposition', 'attachment; filename="bookings.csv"')
  const rows = await env.DB.prepare('SELECT * FROM bookings WHERE tenant_id = ? ORDER BY start_time ASC').bind(user.tenant_id).all()
    const lines = ['id,room_id,customer_id,start_time,end_time,status,total_amount']
  for (const b of ((rows?.results as any[]) || [])) {
      lines.push([b.id, b.room_id, b.customer_id, b.start_time, b.end_time, b.status, b.total_amount ?? ''].join(','))
    }
    return new Response(lines.join('\n'), { headers })
  }
  if (url.pathname.endsWith('/revenue.csv')) {
    headers.set('Content-Disposition', 'attachment; filename="revenue.csv"')
  const rows = await env.DB.prepare('SELECT date(start_time) as day, SUM(total_amount) as revenue FROM bookings WHERE tenant_id = ? AND status = ? GROUP BY day ORDER BY day ASC').bind(user.tenant_id, 'confirmed').all()
    const lines = ['date,revenue']
  for (const r of ((rows?.results as any[]) || [])) lines.push([r.day, r.revenue ?? 0].join(','))
    return new Response(lines.join('\n'), { headers })
  }
  if (url.pathname.endsWith('/occupancy.csv')) {
    headers.set('Content-Disposition', 'attachment; filename="occupancy.csv"')
    const openHoursPerDay = Number((searchParams.get('open_hours_per_day') || '12'))
    const days = Math.max(1, Math.ceil((Date.parse(to) - Date.parse(from)) / 86400000))
    const rooms = await env.DB.prepare(`SELECT id, name FROM rooms WHERE tenant_id = ? AND is_active = 1`).bind(user.tenant_id).all()
    const roomList = ((rooms?.results as any[]) || [])
    const lines = ['room_id,room_name,booked_hours,available_hours,utilization']
    for (const r of roomList) {
      const hoursRow = await dbFirst(env, `SELECT SUM((julianday(end_time) - julianday(start_time)) * 24.0) as h FROM bookings WHERE tenant_id = ? AND room_id = ? AND status='confirmed' AND start_time BETWEEN ? AND ?`, [user.tenant_id, r.id, from, to])
      const booked = hoursRow?.h || 0
      const available = openHoursPerDay * days
      const util = available > 0 ? booked / available : 0
      lines.push([r.id, JSON.stringify(r.name || ''), (Math.round(booked * 100) / 100), available, (Math.round(util * 10000) / 10000)].join(','))
    }
    return new Response(lines.join('\n'), { headers })
  }
  if (url.pathname.endsWith('/staff.csv')) {
    headers.set('Content-Disposition', 'attachment; filename="staff_performance.csv"')
    const byStaff = await env.DB.prepare(`
      SELECT u.id as staff_id, u.name as staff_name,
             SUM(CASE WHEN b.status='confirmed' THEN 1 ELSE 0 END) as bookings,
             SUM(CASE WHEN b.status='confirmed' THEN b.total_amount ELSE 0 END) as revenue
      FROM users u
      LEFT JOIN bookings b ON b.staff_id = u.id AND b.tenant_id = u.tenant_id
      WHERE u.tenant_id = ? AND u.role IN ('Receptionist','Staff/Instructor','Studio Manager','Admin')
        AND (b.start_time IS NULL OR b.start_time BETWEEN ? AND ?)
      GROUP BY u.id, u.name
      ORDER BY revenue DESC NULLS LAST, bookings DESC
    `).bind(user.tenant_id, from, to).all()
    const rows = ((byStaff?.results as any[]) || [])
    const lines = ['staff_id,staff_name,bookings,revenue']
    for (const r of rows) {
      lines.push([r.staff_id, JSON.stringify(r.staff_name || ''), r.bookings || 0, r.revenue || 0].join(','))
    }
    return new Response(lines.join('\n'), { headers })
  }
  return new Response('Not found', { status: 404 })
}

// --- Analytics API ---
async function handleAnalytics(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
  const user = await getUserFromSession(request, env)
  if (!user) return json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const searchParams = url.searchParams
  const from = searchParams.get('from') || new Date(Date.now() - 29*24*3600*1000).toISOString()
  const to = searchParams.get('to') || new Date().toISOString()

  const path = url.pathname

  // Summary KPIs
  if (path === '/api/analytics/summary' && request.method === 'GET') {
    const totalBookings = await dbFirst(env, `SELECT COUNT(*) as c FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND start_time BETWEEN ? AND ?`, [user.tenant_id, from, to])
    const revenueRow = await dbFirst(env, `SELECT SUM(total_amount) as s FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND start_time BETWEEN ? AND ?`, [user.tenant_id, from, to])
    const avgVal = await dbFirst(env, `SELECT AVG(x) as a FROM (SELECT total_amount as x FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND total_amount IS NOT NULL AND start_time BETWEEN ? AND ?)`, [user.tenant_id, from, to])
    const uniqueCustomers = await dbFirst(env, `SELECT COUNT(DISTINCT customer_id) as c FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND start_time BETWEEN ? AND ?`, [user.tenant_id, from, to])
    const roomsCount = await dbFirst(env, `SELECT COUNT(*) as c FROM rooms WHERE tenant_id = ? AND is_active = 1`, [user.tenant_id])
    const days = Math.max(1, Math.ceil((Date.parse(to) - Date.parse(from)) / 86400000))
    const bookedHoursRow = await dbFirst(env, `SELECT SUM((julianday(end_time) - julianday(start_time)) * 24.0) as h FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND start_time BETWEEN ? AND ?`, [user.tenant_id, from, to])
    const openHoursPerDay = Number((searchParams.get('open_hours_per_day') || '12'))
    const totalAvailable = (roomsCount?.c || 0) * openHoursPerDay * days
    const occupancyRate = totalAvailable > 0 ? Math.min(1, Math.max(0, (bookedHoursRow?.h || 0) / totalAvailable)) : 0
    const peakHour = await dbFirst(env, `SELECT strftime('%H', start_time) as hour, COUNT(*) as c FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND start_time BETWEEN ? AND ? GROUP BY hour ORDER BY c DESC LIMIT 1`, [user.tenant_id, from, to])
    const peakDay = await dbFirst(env, `SELECT strftime('%w', start_time) as weekday, COUNT(*) as c FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND start_time BETWEEN ? AND ? GROUP BY weekday ORDER BY c DESC LIMIT 1`, [user.tenant_id, from, to])
    return json({ success: true, data: {
      total_bookings: totalBookings?.c || 0,
      revenue: revenueRow?.s || 0,
      avg_booking_value: avgVal?.a || 0,
      unique_customers: uniqueCustomers?.c || 0,
      occupancy_rate: occupancyRate,
      peak_hour: (peakHour?.hour ?? null),
      peak_day_of_week: (peakDay?.weekday ?? null),
      assumptions: { open_hours_per_day: openHoursPerDay, days }
    }})
  }

  // Forecasts (moving average approach)
  if (path === '/api/analytics/forecast' && request.method === 'GET') {
    const metric = (url.searchParams.get('metric') || 'revenue') as 'revenue' | 'bookings'
    const period = (url.searchParams.get('period') || 'monthly') as 'monthly' | 'weekly'
    const months = Math.min(12, Math.max(1, Number(url.searchParams.get('months') || '3')))
    const now = new Date()
    const since = new Date(now)
    since.setMonth(now.getMonth() - 6)
    const sinceIso = since.toISOString()
    if (period === 'monthly') {
      const rows = await env.DB.prepare(`
        SELECT strftime('%Y-%m', start_time) as ym,
               SUM(CASE WHEN status='confirmed' THEN total_amount ELSE 0 END) as revenue,
               SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) as bookings
        FROM bookings WHERE tenant_id = ? AND start_time >= ?
        GROUP BY ym ORDER BY ym ASC
      `).bind(user.tenant_id, sinceIso).all()
      const items = ((rows?.results as any[]) || []).map(r => ({ period: r.ym, revenue: r.revenue || 0, bookings: r.bookings || 0 }))
      const last3 = items.slice(-3)
      const avgRevenue = last3.length ? last3.reduce((s, i) => s + i.revenue, 0) / last3.length : 0
      const avgBookings = last3.length ? last3.reduce((s, i) => s + i.bookings, 0) / last3.length : 0
      const forecasts = [] as Array<{ period: string; value: number }>
      let year = now.getFullYear(); let m = now.getMonth()
      for (let i = 0; i < months; i++) {
        m++; if (m > 11) { m = 0; year++ }
        const label = `${year}-${String(m+1).padStart(2,'0')}`
        forecasts.push({ period: label, value: metric === 'revenue' ? Math.round(avgRevenue * 100) / 100 : Math.round(avgBookings) })
      }
      return json({ success: true, data: { period: 'monthly', metric, history: items, forecasts, method: 'moving_average_last3' } })
    } else {
      const rows = await env.DB.prepare(`
        SELECT strftime('%Y-%W', start_time) as yw,
               SUM(CASE WHEN status='confirmed' THEN total_amount ELSE 0 END) as revenue,
               SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) as bookings
        FROM bookings WHERE tenant_id = ? AND start_time >= ?
        GROUP BY yw ORDER BY yw ASC
      `).bind(user.tenant_id, sinceIso).all()
      const items = ((rows?.results as any[]) || []).map(r => ({ period: r.yw, revenue: r.revenue || 0, bookings: r.bookings || 0 }))
      const last4 = items.slice(-4)
      const avgRevenue = last4.length ? last4.reduce((s, i) => s + i.revenue, 0) / last4.length : 0
      const avgBookings = last4.length ? last4.reduce((s, i) => s + i.bookings, 0) / last4.length : 0
      const forecasts = [] as Array<{ period: string; value: number }>
      let y = now.getFullYear(); let w = Number(strftimeWeek(now))
      for (let i = 0; i < months * 4; i++) {
        w++; if (w > 52) { w = 0; y++ }
        const label = `${y}-${String(w).padStart(2,'0')}`
        forecasts.push({ period: label, value: metric === 'revenue' ? Math.round(avgRevenue * 100) / 100 : Math.round(avgBookings) })
      }
      return json({ success: true, data: { period: 'weekly', metric, history: items, forecasts, method: 'moving_average_last4' } })
    }
  }

  // Customer analytics
  if (path === '/api/analytics/customers' && request.method === 'GET') {
    const today = new Date()
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth()-1, 1).toISOString()
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23,59,59).toISOString()
    const setPrev = await env.DB.prepare(`SELECT DISTINCT customer_id as id FROM bookings WHERE tenant_id = ? AND status='confirmed' AND start_time BETWEEN ? AND ?`).bind(user.tenant_id, startOfPrevMonth, endOfPrevMonth).all()
    const setThis = await env.DB.prepare(`SELECT DISTINCT customer_id as id FROM bookings WHERE tenant_id = ? AND status='confirmed' AND start_time >= ?`).bind(user.tenant_id, startOfThisMonth).all()
    const prevIds = new Set(((setPrev?.results as any[]) || []).map(r => r.id))
    const thisIds = new Set(((setThis?.results as any[]) || []).map(r => r.id))
    let retained = 0; prevIds.forEach(id => { if (thisIds.has(id)) retained++ })
    const retentionRate = prevIds.size ? retained / prevIds.size : 0
    const churnRate = prevIds.size ? 1 - retentionRate : 0
    const last180 = new Date(Date.now() - 180*24*3600*1000).toISOString()
    const revRows = await env.DB.prepare(`SELECT customer_id, SUM(total_amount) as revenue FROM bookings WHERE tenant_id = ? AND status='confirmed' AND start_time >= ? GROUP BY customer_id`).bind(user.tenant_id, last180).all()
    const revenues = ((revRows?.results as any[]) || []).map(r => r.revenue || 0)
    const avgCLV = revenues.length ? (revenues.reduce((s, x) => s + (Number(x) || 0), 0) / revenues.length) : 0
    return json({ success: true, data: { retention_rate: retentionRate, churn_rate: churnRate, avg_clv: Math.round(avgCLV * 100) / 100, cohorts: { prev_month: prevIds.size, this_month: thisIds.size, retained } } })
  }

  // Occupancy and peak times
  if (path === '/api/analytics/occupancy' && request.method === 'GET') {
    const openHoursPerDay = Number((url.searchParams.get('open_hours_per_day') || '12'))
    const days = Math.max(1, Math.ceil((Date.parse(to) - Date.parse(from)) / 86400000))
    const rooms = await env.DB.prepare(`SELECT id, name FROM rooms WHERE tenant_id = ? AND is_active = 1`).bind(user.tenant_id).all()
    const roomList = ((rooms?.results as any[]) || [])
    const perRoom: any[] = []
    for (const r of roomList) {
      const hoursRow = await dbFirst(env, `SELECT SUM((julianday(end_time) - julianday(start_time)) * 24.0) as h FROM bookings WHERE tenant_id = ? AND room_id = ? AND status='confirmed' AND start_time BETWEEN ? AND ?`, [user.tenant_id, r.id, from, to])
      const booked = hoursRow?.h || 0
      const available = openHoursPerDay * days
      perRoom.push({ room_id: r.id, room_name: r.name, booked_hours: booked, available_hours: available, utilization: available > 0 ? booked / available : 0 })
    }
    const hoursHistRows = await env.DB.prepare(`SELECT strftime('%H', start_time) as hour, COUNT(*) as c FROM bookings WHERE tenant_id = ? AND status='confirmed' AND start_time BETWEEN ? AND ? GROUP BY hour ORDER BY hour ASC`).bind(user.tenant_id, from, to).all()
    const hoursHist = ((hoursHistRows?.results as any[]) || []).map(r => ({ hour: r.hour, count: r.c }))
    return json({ success: true, data: { per_room: perRoom, hours_hist: hoursHist, assumptions: { open_hours_per_day: openHoursPerDay, days } } })
  }

  // Staff performance (requires bookings.staff_id)
  if (path === '/api/analytics/staff' && request.method === 'GET') {
    const byStaff = await env.DB.prepare(`
      SELECT u.id as staff_id, u.name as staff_name,
             SUM(CASE WHEN b.status='confirmed' THEN 1 ELSE 0 END) as bookings,
             SUM(CASE WHEN b.status='confirmed' THEN b.total_amount ELSE 0 END) as revenue
      FROM users u
      LEFT JOIN bookings b ON b.staff_id = u.id AND b.tenant_id = u.tenant_id
      WHERE u.tenant_id = ? AND u.role IN ('Receptionist','Staff/Instructor','Studio Manager','Admin')
        AND (b.start_time IS NULL OR b.start_time BETWEEN ? AND ?)
      GROUP BY u.id, u.name
      ORDER BY revenue DESC NULLS LAST, bookings DESC
    `).bind(user.tenant_id, from, to).all()
    const results = ((byStaff?.results as any[]) || []).map(r => ({ staff_id: r.staff_id, staff_name: r.staff_name, bookings: r.bookings || 0, revenue: r.revenue || 0 }))
    return json({ success: true, data: { staff: results, note: 'Metrics use bookings.staff_id when present; otherwise values may be zero until staff assignment is implemented.' } })
  }

  return json({ success: false, message: 'Not found' }, { status: 404 })
}

function strftimeWeek(d: Date): string {
  // ISO week number approximation
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7)
  return String(weekNo)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  // Bootstrap first SuperAdmin (one-time or with key)
    if (url.pathname === '/api/bootstrap-superadmin' && request.method === 'POST') {
      if (!env.DB) return json({ success: false, message: 'DB not bound' }, { status: 503 })
      await ensureAdminTables(env)
      const superCount = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM users WHERE role = ? LIMIT 1', ['SuperAdmin'])
      if ((superCount?.cnt || 0) > 0) return json({ success: false, message: 'SuperAdmin already configured' }, { status: 403 })
      const totalUsers = await dbFirst(env, 'SELECT COUNT(*) as cnt FROM users LIMIT 1')
      const body = await request.json().catch(() => ({})) as any
      const name = (body.name || '').trim()
      const email = (body.email || '').toLowerCase().trim()
      const password = body.password || ''
      if (!name || !email || !password) return json({ success: false, message: 'name, email, password required' }, { status: 400 })
      if ((totalUsers?.cnt || 0) > 0) {
        const keyHdr = request.headers.get('x-bootstrap-key') || ''
        const bootstrapKey = (env as any).ADMIN_BOOTSTRAP_KEY
        if (!bootstrapKey || keyHdr !== bootstrapKey) return json({ success: false, message: 'Bootstrap key required' }, { status: 403 })
      }
      const exists = await dbFirst(env, 'SELECT id FROM users WHERE email = ? LIMIT 1', [email])
      if (exists) return json({ success: false, message: 'Email already exists' }, { status: 400 })
      const hash = await generateWerkzeugPBKDF2(password)
      await dbRun(env, 'INSERT INTO users (tenant_id, studio_id, name, email, password_hash, role, permissions, is_active) VALUES (NULL, NULL, ?, ?, ?, ?, ?, 1)', [name, email, hash, 'SuperAdmin', JSON.stringify(['*'])])
      const created = await dbFirst(env, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email])
      return json({ success: true, data: serializeUser(created), message: 'SuperAdmin created' }, { status: 201 })
    }
    // Global admin routes
    if (url.pathname.startsWith('/api/admin')) {
      return handleAdmin(request, env, url)
    }

    // Tenant-facing announcements
    if (url.pathname === '/api/announcements' && request.method === 'GET') {
      return handleAnnouncements(request, env, url)
    }

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
    if (url.pathname.startsWith('/api/analytics')) {
      return handleAnalytics(request, env, url)
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
