// ============================================================
// SnapTrack API — Cloudflare Pages Functions + D1
// Lives at: /functions/api/[[path]].js  →  served at yoursite.pages.dev/api/*
// Requires: a D1 database bound to this Pages project as "DB",
//           and an environment variable AUTH_SECRET (any long random string).
// ============================================================

const STEP_KEYS = ['reached_source','loading_start','loading_end','production_entry_start','production_entry_end','departed','reached_destination','unloading_start','unloading_end'];
const SOURCE_STEPS = ['reached_source','loading_start','loading_end','production_entry_start','production_entry_end','departed'];
const DELAY_CHECK_STEP = { loading_end:'loading', reached_destination:'travel', unloading_end:'unloading' };
const EXIT_GATE_STEP = 'exit_gate';

function createDevDbAdapter(){
  if(globalThis.__snaptrackDevDb) return globalThis.__snaptrackDevDb;
  const store = {
    vehicles: [
      { id:'v1', number:'KA51C7149', active:1 },
      { id:'v2', number:'MH43U6997', active:1 },
      { id:'v3', number:'KA529430', active:1 },
      { id:'v4', number:'KA52A8993', active:1 },
      { id:'v5', number:'KA526702', active:1 }
    ],
    locations: [
      { id:'l1', name:'YB Factory', active:1 },
      { id:'l2', name:'YB FG Warehouse', active:1 },
      { id:'l3', name:'RM Warehouse', active:1 },
      { id:'l4', name:'Tumkur Wh', active:1 },
      { id:'l5', name:'Tumkur New Wh', active:1 }
    ],
    delay_reasons: [
      { id:'dr1', label:'Invoicing Delay', active:1 },
      { id:'dr2', label:'Unloading Delay', active:1 },
      { id:'dr3', label:'Production Entry Delay', active:1 },
      { id:'dr4', label:'Manpower Issue', active:1 },
      { id:'dr5', label:'Storage Pallet Issue', active:1 }
    ],
    users: [],
    settings: [{ id:1, expected_loading:30, expected_unloading:25, expected_travel:60, workday_hours:10 }],
    trips: [],
    trip_delays: []
  };
  class DevStatement {
    constructor(query, store){ this.query=query.trim(); this.store=store; this.params=[]; }
    bind(...params){ this.params=params; return this; }
    async first(){ return executeDevQuery(this.query, this.params, this.store, false); }
    async all(){ return executeDevQuery(this.query, this.params, this.store, true); }
    async run(){ return executeDevMutation(this.query, this.params, this.store); }
  }
  function executeDevQuery(query, params, store, all){
    const q = query.replace(/\s+/g,' ').trim().toLowerCase();
    if(q.includes('select count(*) as n from users')) return { n: store.users.length };
    if(q.includes('select * from users where id=? and active=1')) return store.users.find(r=>r.id===params[0] && r.active===1) || null;
    if(q.includes('select * from users where username=?')) return store.users.find(r=>r.username===params[0]) || null;
    if(q.includes('select * from vehicles order by number')) return { results: [...store.vehicles].sort((a,b)=>a.number.localeCompare(b.number)) };
    if(q.includes('select * from locations order by name')) return { results: [...store.locations].sort((a,b)=>a.name.localeCompare(b.name)) };
    if(q.includes('select * from delay_reasons order by label')) return { results: [...store.delay_reasons].sort((a,b)=>a.label.localeCompare(b.label)) };
    if(q.includes('select * from settings where id=1')) return store.settings.find(r=>r.id===1) || null;
    if(q.includes('select * from users order by name')) return { results: [...store.users].sort((a,b)=>a.name.localeCompare(b.name)) };
    if(q.includes('select * from trips where created_at between ? and ?')){
      let rows = store.trips.filter(r=>r.created_at>=Number(params[0]) && r.created_at<=Number(params[1]));
      if(q.includes('order by created_at desc')) rows = rows.sort((a,b)=>b.created_at-a.created_at);
      return { results: rows };
    }
    if(q.includes('select * from trips where id=?')) return store.trips.find(r=>r.id===params[0]) || null;
    if(q.includes('select id from trips where vehicle_id=? and status=\'in_progress\'')) return store.trips.find(r=>r.vehicle_id===params[0] && r.status==='in_progress') || null;
    if(q.includes('select number from vehicles where id=?')) return store.vehicles.find(r=>r.id===params[0]) || null;
    if(q.includes('select name from locations where id=?')) return store.locations.find(r=>r.id===params[0]) || null;
    if(q.includes('select label from delay_reasons where id=?')) return store.delay_reasons.find(r=>r.id===params[0]) || null;
    if(q.includes('select id from trip_delays where trip_id=? and segment=?')) return store.trip_delays.find(r=>r.trip_id===params[0] && r.segment===params[1]) || null;
    if(q.includes('select * from trips where created_at between ? and ? and vehicle_id=?')){
      let rows = store.trips.filter(r=>r.created_at>=Number(params[0]) && r.created_at<=Number(params[1]) && r.vehicle_id===params[2]);
      if(q.includes('order by created_at desc')) rows = rows.sort((a,b)=>b.created_at-a.created_at);
      return { results: rows };
    }
    if(q.includes('select * from trips where created_at between ? and ? and vehicle_id=?') || q.includes('select * from trips where created_at between ? and ?')){
      let rows = store.trips.filter(r=>r.created_at>=Number(params[0]) && r.created_at<=Number(params[1]));
      if(params[2] && params[2]!=='all') rows = rows.filter(r=>r.vehicle_id===params[2]);
      return { results: rows.sort((a,b)=>b.created_at-a.created_at) };
    }
    return all ? { results: [] } : null;
  }
  function executeDevMutation(query, params, store){
    const q = query.replace(/\s+/g,' ').trim().toLowerCase();
    if(q.startsWith('insert into users')){
      const row = { id: params[0], name: params[1], username: params[2], password_hash: params[3], role: params[4], location_id: params[5], active: 1 };
      store.users.push(row); return { success:true };
    }
    if(q.startsWith('insert into vehicles')){
      store.vehicles.push({ id: params[0], number: params[1], active: 1 }); return { success:true };
    }
    if(q.startsWith('insert into locations')){
      store.locations.push({ id: params[0], name: params[1], active: 1 }); return { success:true };
    }
    if(q.startsWith('insert into delay_reasons')){
      store.delay_reasons.push({ id: params[0], label: params[1], active: 1 }); return { success:true };
    }
    if(q.startsWith('insert into trips')){
      const row = {
        id: params[0], vehicle_id: params[1], vehicle_number: params[2], driver_name: params[3], created_by: params[4],
        source_id: params[5], dest_id: params[6], source_name: params[7], dest_name: params[8], status: params[9], created_at: params[10], completed_at: params[11], reached_source: params[12], loading_start: null, loading_end: null, production_entry_start: null, production_entry_end: null, departed: null, reached_destination: null, unloading_start: null, unloading_end: null
      };
      store.trips.push(row); return { success:true };
    }
    if(q.startsWith('insert into trip_delays')){
      store.trip_delays.push({ id: params[0], trip_id: params[1], segment: params[2], reason_id: params[3], reason_label: params[4], remarks: params[5], captured_at: params[6] }); return { success:true };
    }
    if(q.startsWith('update settings set')){
      const row = store.settings.find(r=>r.id===1); if(row){ Object.assign(row, { expected_loading: params[0], expected_unloading: params[1], expected_travel: params[2], workday_hours: params[3] }); }
      return { success:true };
    }
    if(q.startsWith('update users set active=? where id=?')){
      const row = store.users.find(r=>r.id===params[1]); if(row) row.active = params[0]; return { success:true };
    }
    if(q.startsWith('update users set password_hash=? where id=?')){
      const row = store.users.find(r=>r.id===params[1]); if(row) row.password_hash = params[0]; return { success:true };
    }
    if(q.startsWith('update trips set')){
      const trip = store.trips.find(r=>r.id===params[params.length-1]);
      if(trip){
        if(q.startsWith("update trips set status='completed', completed_at=?")){
          trip.status = 'completed';
          trip.completed_at = params[0];
        }else{
          const col = q.match(/update trips set ([a-z_]+)=\?/)[1];
          trip[col] = params[0];
        }
      }
      return { success:true };
    }
    if(q.startsWith('delete from trip_delays where trip_id=? and segment=?')){
      store.trip_delays = store.trip_delays.filter(r=>!(r.trip_id===params[0] && r.segment===params[1])); return { success:true };
    }
    if(q.startsWith('delete from')){
      const table = q.split('delete from ')[1].split(' where ')[0];
      const key = q.includes('where id=?') ? 'id' : null;
      if(table && key){ store[table] = store[table].filter(r=>r.id!==params[0]); }
      return { success:true };
    }
    return { success:true };
  }
  const adapter = { prepare(query){ return new DevStatement(query, store); } };
  globalThis.__snaptrackDevDb = adapter;
  return adapter;
}

// ---------- small helpers ----------
function json(data, status=200){
  return new Response(JSON.stringify(data), {
    status,
    headers:{ 'content-type':'application/json', 'access-control-allow-origin':'*', 'access-control-allow-headers':'content-type,authorization', 'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS' }
  });
}
function err(msg, status=400){ return json({ error: msg }, status); }
function uid(){ return crypto.randomUUID(); }
function b64url(bytes){ return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64urlToBytes(str){ str = str.replace(/-/g,'+').replace(/_/g,'/'); while(str.length%4) str+='='; const bin=atob(str); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i); return arr; }
function textToBytes(s){ return new TextEncoder().encode(s); }

// ---------- password hashing (PBKDF2 — real, salted, iterated) ----------
async function hashPassword(password){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', textToBytes(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:100000, hash:'SHA-256'}, key, 256);
  return `pbkdf2:${b64url(salt)}:${b64url(bits)}`;
}
async function verifyPassword(password, stored){
  const [, saltB64, hashB64] = stored.split(':');
  const salt = b64urlToBytes(saltB64);
  const key = await crypto.subtle.importKey('raw', textToBytes(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:100000, hash:'SHA-256'}, key, 256);
  return b64url(bits) === hashB64;
}

// ---------- signed session tokens (HMAC-SHA256, no server-side session store needed) ----------
async function signToken(payload, secret){
  const body = b64url(textToBytes(JSON.stringify(payload)));
  const secretText = secret || 'dev-secret';
  const key = await crypto.subtle.importKey('raw', textToBytes(secretText), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, textToBytes(body));
  return `${body}.${b64url(sig)}`;
}
async function verifyToken(token, secret){
  if(!token) return null;
  const [body, sig] = token.split('.');
  if(!body || !sig) return null;
  const secretText = secret || 'dev-secret';
  const key = await crypto.subtle.importKey('raw', textToBytes(secretText), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const expected = b64url(await crypto.subtle.sign('HMAC', key, textToBytes(body)));
  if(expected !== sig) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
  if(payload.exp && Date.now() > payload.exp) return null;
  return payload;
}
async function getAuthedUser(request, env){
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = await verifyToken(token, env.AUTH_SECRET || 'dev-secret');
  if(!payload) return null;
  const row = await env.DB.prepare('SELECT * FROM users WHERE id=? AND active=1').bind(payload.uid).first();
  return row || null;
}

// ---------- row <-> API shape helpers ----------
function tripRowToApi(r){
  return {
    id:r.id, vehicleId:r.vehicle_id, vehicleNumber:r.vehicle_number, driverName:r.driver_name, createdBy:r.created_by,
    sourceId:r.source_id, destId:r.dest_id, sourceName:r.source_name, destName:r.dest_name,
    status:r.status, createdAt:r.created_at, completedAt:r.completed_at,
    ts:{ reachedSource:r.reached_source, loadingStart:r.loading_start, loadingEnd:r.loading_end,
      productionEntryStart:r.production_entry_start, productionEntryEnd:r.production_entry_end,
      departed:r.departed, reachedDestination:r.reached_destination, unloadingStart:r.unloading_start,
      unloadingEnd:r.unloading_end, exitGate:r.completed_at }
  };
}
function userRowSafe(r){ return { id:r.id, name:r.name, username:r.username, role:r.role, locationId:r.location_id, active:!!r.active }; }
function nextStepKey(row){
  for(const k of STEP_KEYS){ if(!row[k]) return k; }
  if(row.unloading_end && !row.completed_at) return EXIT_GATE_STEP;
  return null;
}
function stepLocationCol(key){ return SOURCE_STEPS.includes(key) ? 'source_id' : 'dest_id'; }

// ============================================================
export async function onRequest(context){
  const { request, env } = context;
  if(!env.DB || typeof env.DB.prepare !== 'function') env.DB = createDevDbAdapter();
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const segs = path.split('/').filter(Boolean);
  const method = request.method;

  if(method === 'OPTIONS') return json({});

  try{
    // ---------- public routes ----------
    if(method==='GET' && path==='setup-status') return await handleSetupStatus(env);
    if(method==='POST' && path==='setup') return await handleSetup(request, env);
    if(method==='POST' && path==='login') return await handleLogin(request, env);

    // ---------- everything below requires a valid token ----------
    const user = await getAuthedUser(request, env);
    if(!user) return err('Not authenticated', 401);

    if(method==='GET' && path==='bootstrap') return await handleBootstrap(env, user);
    if(method==='GET' && path==='trips') return await handleTripsList(url, env);
    if(method==='POST' && path==='trips') return await handleTripCreate(request, env, user);
    if(method==='POST' && segs[0]==='trips' && segs[2]==='advance') return await handleTripAdvance(segs[1], request, env, user);
    if(method==='POST' && segs[0]==='trips' && segs[2]==='delay') return await handleTripDelay(segs[1], request, env, user);

    if(segs[0]==='vehicles') return await crudHandler(request, env, user, segs, {
      table:'vehicles', fields:['number'], unique:'number', adminOnly:true
    });
    if(segs[0]==='locations') return await crudHandler(request, env, user, segs, {
      table:'locations', fields:['name'], unique:'name', adminOnly:true
    });
    if(segs[0]==='delay-reasons') return await crudHandler(request, env, user, segs, {
      table:'delay_reasons', fields:['label'], unique:'label', adminOnly:true
    });

    if(path==='users' && method==='GET') return await handleUsersList(env, user);
    if(path==='users' && method==='POST') return await handleUserCreate(request, env, user);
    if(segs[0]==='users' && segs[1] && method==='PATCH') return await handleUserPatch(segs[1], request, env, user);
    if(segs[0]==='users' && segs[1] && segs[2]==='password' && method==='POST') return await handleUserPassword(segs[1], request, env, user);

    if(path==='settings' && method==='GET') return await handleSettingsGet(env);
    if(path==='settings' && method==='PUT') return await handleSettingsPut(request, env, user);

    return err('Not found', 404);
  }catch(e){
    return err('Server error: '+e.message, 500);
  }
}

// ---------- auth ----------
async function handleSetupStatus(env){
  const count = await env.DB.prepare('SELECT COUNT(*) as n FROM users').first();
  return json({ needsSetup: count.n === 0 });
}
async function handleSetup(request, env){
  const count = await env.DB.prepare('SELECT COUNT(*) as n FROM users').first();
  if(count.n > 0) return err('Setup already completed — an admin account already exists.', 409);
  const { name, username, password } = await request.json();
  if(!name || !username || !password || password.length<4) return err('Name, username, and a password of at least 4 characters are required.');
  const id = uid();
  const hash = await hashPassword(password);
  await env.DB.prepare('INSERT INTO users (id,name,username,password_hash,role,location_id,active) VALUES (?,?,?,?,?,?,1)')
    .bind(id, name, username.toLowerCase(), hash, 'admin', null).run();
  const token = await signToken({uid:id, exp:Date.now()+30*86400000}, env.AUTH_SECRET);
  return json({ token, user: {id, name, username:username.toLowerCase(), role:'admin', locationId:null, active:true} });
}
async function handleLogin(request, env){
  const { username, password } = await request.json();
  const normalized = (username||'').toLowerCase();
  const row = await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(normalized).first();
  const passwordOk = row && await verifyPassword(password||'', row.password_hash);
  if(!row || !passwordOk) return err('Incorrect username or password.', 401);
  if(!row.active) return err('This account has been deactivated. Contact your Admin.', 403);
  const token = await signToken({uid:row.id, exp:Date.now()+30*86400000}, env.AUTH_SECRET || 'dev-secret');
  return json({ token, user: userRowSafe(row) });
}

// ---------- bootstrap / settings ----------
async function handleBootstrap(env, user){
  const [vehicles, locations, delayReasons, settings, users] = await Promise.all([
    env.DB.prepare('SELECT * FROM vehicles ORDER BY number').all(),
    env.DB.prepare('SELECT * FROM locations ORDER BY name').all(),
    env.DB.prepare('SELECT * FROM delay_reasons ORDER BY label').all(),
    env.DB.prepare('SELECT * FROM settings WHERE id=1').first(),
    env.DB.prepare('SELECT * FROM users ORDER BY name').all(),
  ]);
  return json({
    vehicles: vehicles.results, locations: locations.results, delayReasons: delayReasons.results,
    settings: settingsRowToApi(settings),
    users: users.results.map(userRowSafe),
    me: userRowSafe(user)
  });
}
function settingsRowToApi(r){ return { expectedLoading:r.expected_loading, expectedUnloading:r.expected_unloading, expectedTravel:r.expected_travel, workdayHours:r.workday_hours }; }
async function handleSettingsGet(env){ const r = await env.DB.prepare('SELECT * FROM settings WHERE id=1').first(); return json(settingsRowToApi(r)); }
async function handleSettingsPut(request, env, user){
  if(user.role!=='admin') return err('Admin only.', 403);
  const b = await request.json();
  await env.DB.prepare('UPDATE settings SET expected_loading=?, expected_unloading=?, expected_travel=?, workday_hours=? WHERE id=1')
    .bind(b.expectedLoading||30, b.expectedUnloading||25, b.expectedTravel||60, b.workdayHours||10).run();
  return json({ ok:true });
}

// ---------- generic CRUD for vehicles / locations / delay-reasons ----------
async function crudHandler(request, env, user, segs, cfg){
  const method = request.method;
  if(method==='GET' && segs.length===1){
    const rows = await env.DB.prepare(`SELECT * FROM ${cfg.table} ORDER BY ${cfg.unique}`).all();
    return json(rows.results);
  }
  if(cfg.adminOnly && user.role!=='admin' && user.role!=='manager') return err('Not permitted.', 403);
  if(method==='POST' && segs.length===1){
    const b = await request.json();
    const val = (b[cfg.fields[0]]||'').trim();
    if(!val) return err(cfg.fields[0]+' is required.');
    const id = uid();
    try{
      await env.DB.prepare(`INSERT INTO ${cfg.table} (id, ${cfg.unique}, active) VALUES (?,?,1)`).bind(id, val).run();
    }catch(e){ return err('That value already exists.', 409); }
    return json({ id, [cfg.unique]: val, active:1 });
  }
  if(method==='PATCH' && segs.length===2){
    const b = await request.json();
    if(b[cfg.unique]!=null){
      const val = b[cfg.unique].trim();
      if(!val) return err('Value cannot be empty.');
      try{ await env.DB.prepare(`UPDATE ${cfg.table} SET ${cfg.unique}=? WHERE id=?`).bind(val, segs[1]).run(); }
      catch(e){ return err('Another record already uses that value.', 409); }
    }
    if(b.active!=null){ await env.DB.prepare(`UPDATE ${cfg.table} SET active=? WHERE id=?`).bind(b.active?1:0, segs[1]).run(); }
    return json({ ok:true });
  }
  if(method==='DELETE' && segs.length===2){
    await env.DB.prepare(`DELETE FROM ${cfg.table} WHERE id=?`).bind(segs[1]).run();
    return json({ ok:true });
  }
  return err('Not found', 404);
}

// ---------- users ----------
async function handleUsersList(env, user){
  if(user.role!=='admin') return err('Admin only.', 403);
  const rows = await env.DB.prepare('SELECT * FROM users ORDER BY name').all();
  return json(rows.results.map(userRowSafe));
}
async function handleUserCreate(request, env, user){
  if(user.role!=='admin') return err('Admin only.', 403);
  const b = await request.json();
  if(!b.name || !b.username || !b.password || b.password.length<4) return err('Name, username, and a password of at least 4 characters are required.');
  const id = uid();
  const hash = await hashPassword(b.password);
  try{
    await env.DB.prepare('INSERT INTO users (id,name,username,password_hash,role,location_id,active) VALUES (?,?,?,?,?,?,1)')
      .bind(id, b.name, b.username.toLowerCase(), hash, b.role, b.role==='operator'?b.locationId:null).run();
  }catch(e){ return err('That username is already taken.', 409); }
  return json({ id, ok:true });
}
async function handleUserPatch(id, request, env, user){
  if(user.role!=='admin') return err('Admin only.', 403);
  const b = await request.json();
  if(b.active!=null) await env.DB.prepare('UPDATE users SET active=? WHERE id=?').bind(b.active?1:0, id).run();
  return json({ ok:true });
}
async function handleUserPassword(id, request, env, user){
  if(user.role!=='admin') return err('Admin only.', 403);
  const { password } = await request.json();
  if(!password || password.length<4) return err('Password must be at least 4 characters.');
  await env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(password), id).run();
  return json({ ok:true });
}

// ---------- trips ----------
async function handleTripsList(url, env){
  const from = url.searchParams.get('from'); // ms epoch
  const to = url.searchParams.get('to');
  const vehicleId = url.searchParams.get('vehicleId');
  let q = 'SELECT * FROM trips WHERE created_at BETWEEN ? AND ?';
  const args = [Number(from)||0, Number(to)||Date.now()];
  if(vehicleId && vehicleId!=='all'){ q += ' AND vehicle_id=?'; args.push(vehicleId); }
  q += ' ORDER BY created_at DESC';
  const rows = await env.DB.prepare(q).bind(...args).all();
  const trips = rows.results.map(tripRowToApi);
  const delayRows = await env.DB.prepare('SELECT * FROM trip_delays WHERE trip_id IN ('+trips.map(()=>'?').join(',')+')').bind(...trips.map(t=>t.id)).all().catch(()=>({results:[]}));
  const byTrip = {};
  (delayRows.results||[]).forEach(d=>{ (byTrip[d.trip_id]=byTrip[d.trip_id]||{})[d.segment] = { reasonId:d.reason_id, reasonLabel:d.reason_label, remarks:d.remarks, capturedAt:d.captured_at }; });
  trips.forEach(t=>{ t.delays = byTrip[t.id] || {}; });
  return json(trips);
}
async function handleTripCreate(request, env, user){
  const b = await request.json();
  const { vehicleId, sourceId, destId, driverName } = b;
  if(!vehicleId || !sourceId || !destId) return err('vehicleId, sourceId, destId are required.');
  const busy = await env.DB.prepare("SELECT id FROM trips WHERE vehicle_id=? AND status='in_progress'").bind(vehicleId).first();
  if(busy) return err('This vehicle already has an active trip.', 409);
  const vehicle = await env.DB.prepare('SELECT number FROM vehicles WHERE id=?').bind(vehicleId).first();
  const source = await env.DB.prepare('SELECT name FROM locations WHERE id=?').bind(sourceId).first();
  const dest = await env.DB.prepare('SELECT name FROM locations WHERE id=?').bind(destId).first();
  const id = uid();
  const now = Date.now();
  // operators create trips at their own location and it's immediately "reached source";
  // self-service drivers start a trip that still needs an explicit "reached source" tap.
  const immediateReach = user.role==='operator' ? now : null;
  await env.DB.prepare(`INSERT INTO trips (id,vehicle_id,vehicle_number,driver_name,created_by,source_id,dest_id,source_name,dest_name,status,created_at,reached_source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, vehicleId, vehicle.number, driverName||user.name, user.username, sourceId, destId, source.name, dest.name, 'in_progress', now, immediateReach).run();
  const row = await env.DB.prepare('SELECT * FROM trips WHERE id=?').bind(id).first();
  return json(tripRowToApi(row));
}
async function handleTripAdvance(tripId, request, env, user){
  const trip = await env.DB.prepare('SELECT * FROM trips WHERE id=?').bind(tripId).first();
  if(!trip) return err('Trip not found.', 404);
  const key = nextStepKey(trip);
  if(!key) return err('This trip is already complete.', 409);
  const locCol = stepLocationCol(key);
  if(user.role==='operator' && trip[locCol] !== user.location_id) return err('This step must be logged from that location\'s Trip Desk.', 403);
  if(user.role==='driver' && trip.driver_name !== user.name) return err('This is not your trip.', 403);

  const now = Date.now();
    if(key===EXIT_GATE_STEP){
      await env.DB.prepare("UPDATE trips SET status='completed', completed_at=? WHERE id=? AND completed_at IS NULL")
        .bind(now, tripId).run();
    }else{
      await env.DB.prepare(`UPDATE trips SET ${key}=? WHERE id=? AND ${key} IS NULL`)
        .bind(now, tripId).run();
    }

  const updated = await env.DB.prepare('SELECT * FROM trips WHERE id=?').bind(tripId).first();
  const segment = DELAY_CHECK_STEP[key];
  let delayNeeded = null;
  if(segment){
    const settings = await env.DB.prepare('SELECT * FROM settings WHERE id=1').first();
    const delayed = isSegmentDelayed(updated, segment, settings);
    const already = await env.DB.prepare('SELECT id FROM trip_delays WHERE trip_id=? AND segment=?').bind(tripId, segment).first();
    if(delayed && !already) delayNeeded = segment;
  }
  return json({ trip: tripRowToApi(updated), delayNeeded });
}
function isSegmentDelayed(row, segment, settings){
  if(segment==='loading') return row.loading_start && row.loading_end && (row.loading_end-row.loading_start) > settings.expected_loading*60000;
  if(segment==='travel') return row.departed && row.reached_destination && (row.reached_destination-row.departed) > settings.expected_travel*60000;
  if(segment==='unloading') return row.unloading_start && row.unloading_end && (row.unloading_end-row.unloading_start) > settings.expected_unloading*60000;
  return false;
}
async function handleTripDelay(tripId, request, env, user){
  const { segment, reasonId, remarks } = await request.json();
  if(!segment || !reasonId) return err('segment and reasonId are required.');
  const reason = await env.DB.prepare('SELECT label FROM delay_reasons WHERE id=?').bind(reasonId).first();
  await env.DB.prepare('DELETE FROM trip_delays WHERE trip_id=? AND segment=?').bind(tripId, segment).run();
  await env.DB.prepare('INSERT INTO trip_delays (id,trip_id,segment,reason_id,reason_label,remarks,captured_at) VALUES (?,?,?,?,?,?,?)')
    .bind(uid(), tripId, segment, reasonId, reason?reason.label:'', (remarks||'').trim(), Date.now()).run();
  return json({ ok:true });
}
