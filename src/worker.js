const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const fromB64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const id = () => crypto.randomUUID();

async function digest(value) {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:fromB64(salt), iterations:120000 }, key, 256);
  return b64(new Uint8Array(bits));
}
function json(data, status=200, headers={}) { return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8', ...headers}}); }
function cookie(value, maxAge=60*60*24*30) { return `sf_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function readCookie(request) { return request.headers.get('Cookie')?.match(/(?:^|; )sf_session=([^;]+)/)?.[1] || null; }
async function body(request) { try { return await request.json(); } catch { return {}; } }
async function userFor(request, env) {
  const token = readCookie(request); if (!token) return null;
  return await env.DB.prepare('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime(\'now\')').bind(await digest(token)).first();
}
async function requireUser(request, env, role) {
  const user = await userFor(request, env);
  if (!user || (role && user.role !== role)) throw new Response('Niet toegestaan', {status:403});
  return user;
}
function code() { return Array.from(crypto.getRandomValues(new Uint8Array(5)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join(''); }

async function api(request, env, path) {
  if (path === '/api/auth/register' && request.method === 'POST') {
    const {name,email,password,role} = await body(request);
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email||'') || !password || password.length < 8 || !['leerling','leerkracht'].includes(role)) return json({error:'Vul een naam, geldig e-mailadres en een wachtwoord van minstens 8 tekens in.'},400);
    const exists=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email.toLowerCase()).first();
    if(exists) return json({error:'Er bestaat al een account met dit e-mailadres.'},409);
    const salt=b64(crypto.getRandomValues(new Uint8Array(16))); const userId=id();
    await env.DB.prepare('INSERT INTO users (id,name,email,password_hash,password_salt,role) VALUES (?,?,?,?,?,?)').bind(userId,name.trim(),email.toLowerCase(),await passwordHash(password,salt),salt,role).run();
    const token=id()+id(); await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,datetime(\'now\',\'+30 days\'))').bind(await digest(token),userId).run();
    return json({user:{id:userId,name:name.trim(),email,role}},200, {'set-cookie':cookie(token)});
  }
  if (path === '/api/auth/login' && request.method === 'POST') {
    const {email,password}=await body(request); const user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind((email||'').toLowerCase()).first();
    if(!user || !password || await passwordHash(password,user.password_salt)!==user.password_hash) return json({error:'E-mailadres of wachtwoord klopt niet.'},401);
    const token=id()+id(); await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,datetime(\'now\',\'+30 days\'))').bind(await digest(token),user.id).run();
    return json({user:{id:user.id,name:user.name,email:user.email,role:user.role}},200,{'set-cookie':cookie(token)});
  }
  if (path === '/api/auth/logout' && request.method === 'POST') { const token=readCookie(request); if(token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run(); return json({ok:true},200,{'set-cookie':cookie('',0)}); }
  if (path === '/api/me') { const user=await userFor(request,env); return json({user:user||null}); }
  if (path === '/api/classrooms' && request.method === 'GET') { const user=await requireUser(request,env); const rows=await env.DB.prepare(`SELECT c.id,c.name,c.code,c.owner_id,u.name owner_name, CASE WHEN c.owner_id=? THEN 1 ELSE 0 END is_owner FROM classrooms c JOIN memberships m ON m.classroom_id=c.id JOIN users u ON u.id=c.owner_id WHERE m.user_id=? ORDER BY c.created_at DESC`).bind(user.id,user.id).all(); return json({classrooms:rows.results}); }
  if (path === '/api/classrooms' && request.method === 'POST') { const user=await requireUser(request,env,'leerkracht'); const {name}=await body(request); if(!name?.trim()) return json({error:'Geef je klas een naam.'},400); let joinCode=code(); while(await env.DB.prepare('SELECT id FROM classrooms WHERE code=?').bind(joinCode).first()) joinCode=code(); const classroomId=id(); await env.DB.batch([env.DB.prepare('INSERT INTO classrooms (id,name,code,owner_id) VALUES (?,?,?,?)').bind(classroomId,name.trim(),joinCode,user.id),env.DB.prepare('INSERT INTO memberships (classroom_id,user_id) VALUES (?,?)').bind(classroomId,user.id)]); return json({classroom:{id:classroomId,name:name.trim(),code:joinCode,is_owner:1}}); }
  if (path === '/api/classrooms/join' && request.method === 'POST') { const user=await requireUser(request,env); const {code:joinCode}=await body(request); const classroom=await env.DB.prepare('SELECT * FROM classrooms WHERE code=?').bind((joinCode||'').toUpperCase().replace(/[^A-Z0-9]/g,'')).first(); if(!classroom) return json({error:'Deze klascode bestaat niet.'},404); await env.DB.prepare('INSERT OR IGNORE INTO memberships (classroom_id,user_id) VALUES (?,?)').bind(classroom.id,user.id).run(); return json({classroom}); }
  const match=path.match(/^\/api\/classrooms\/([^/]+)\/activities$/);
  if(match && request.method==='GET') { const user=await requireUser(request,env); const member=await env.DB.prepare('SELECT 1 FROM memberships WHERE classroom_id=? AND user_id=?').bind(match[1],user.id).first(); if(!member) throw new Response('Niet toegestaan',{status:403}); const rows=await env.DB.prepare('SELECT id,title,direction,questions_json,created_at FROM activities WHERE classroom_id=? ORDER BY created_at DESC').bind(match[1]).all(); return json({activities:rows.results.map(x=>({...x,questions:JSON.parse(x.questions_json)}))}); }
  if(match && request.method==='POST') { const user=await requireUser(request,env,'leerkracht'); const owns=await env.DB.prepare('SELECT 1 FROM classrooms WHERE id=? AND owner_id=?').bind(match[1],user.id).first(); if(!owns) throw new Response('Alleen de leerkracht kan oefeningen maken.',{status:403}); const {title,direction,questions}=await body(request); if(!title?.trim()||!Array.isArray(questions)||questions.length<1) return json({error:'Geef een titel en minstens één vraag.'},400); const clean=questions.filter(q=>q.prompt?.trim()&&q.answer?.trim()).map(q=>({prompt:q.prompt.trim(),answer:q.answer.trim()})); if(!clean.length)return json({error:'Voeg minstens één volledige vraag toe.'},400); const activityId=id(); await env.DB.prepare('INSERT INTO activities (id,classroom_id,title,direction,questions_json) VALUES (?,?,?,?,?)').bind(activityId,match[1],title.trim(),direction==='fr-nl'?'fr-nl':'nl-fr',JSON.stringify(clean)).run(); return json({activity:{id:activityId,title:title.trim(),direction,questions:clean}}); }
  return json({error:'Niet gevonden'},404);
}

export default { async fetch(request, env) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')) { try { return await api(request,env,url.pathname); } catch(error) { if(error instanceof Response)return error; console.error(error); return json({error:'Er ging iets mis. Probeer opnieuw.'},500); } }
  return env.ASSETS.fetch(request);
} };
