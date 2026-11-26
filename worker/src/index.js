/**
 * Property Reel Maker — API (Cloudflare Worker)
 * Think Through Technology
 *
 * Holds ElevenLabs keys (write-only), checks 30-day subscriptions,
 * counts voice usage, and handles Cashfree payments.
 *
 * Bindings (see wrangler.toml / README):
 *   KV namespace   DB
 *   Secrets        ADMIN_PASSWORD, SESSION_SECRET, CF_APP_ID, CF_SECRET, (optional) ELEVEN_KEY
 *   Vars           CF_ENV = "production" | "sandbox", ALLOWED_ORIGINS = "https://you.github.io,..."
 *                  APP_URL = client page URL (for return links), MOCK_TTS = "1" only for local testing
 */

const DAY = 864e5;
const PERIOD_DAYS = 30;
// Plans — limits are enforced here on the server. Admin can still override per client.
const PLANS = {
  basic:    { name: 'Basic',    amount: 600,  reels: 10, aiVoice: false, chars: 0,     extras: [] },
  standard: { name: 'Standard', amount: 1200, reels: 15, aiVoice: true,  chars: 9000,  extras: [] },
  premium:  { name: 'Premium',  amount: 3000, reels: 20, aiVoice: true,  chars: 12000, extras: ['1 shoot visit', 'Posting by Think Through Technology'] }
};

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(req, env);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e.status || 500;
      return new Response(JSON.stringify({ error: e.expose ? e.message : 'Server error', detail: e.expose ? undefined : String(e.message || e) }), { status, headers: { 'content-type': 'application/json', ...cors } });
    }
  }
};

/* ---------------- helpers ---------------- */
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return { 'Access-Control-Allow-Origin': ok ? (origin || '*') : allowed[0] || '', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Vary': 'Origin' };
}
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
function fail(msg, status = 400) { const e = new Error(msg); e.status = status; e.expose = true; throw e; }
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = s => b64u(enc.encode(s));
const unb64u = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
async function hmac(secret, data, raw) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(data));
  return raw ? sig : b64u(sig);
}
function safeEq(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function signToken(env, payload) { const p = b64uStr(JSON.stringify(payload)); return p + '.' + await hmac(env.SESSION_SECRET, p); }
async function readToken(env, req) {
  const h = req.headers.get('Authorization') || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [p, s] = t.split('.'); if (!p || !s) return null;
  if (!safeEq(s, await hmac(env.SESSION_SECRET, p))) return null;
  const d = JSON.parse(unb64u(p)); if (!d.exp || d.exp < Date.now()) return null; return d;
}
async function hashPin(pin, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256);
  return b64u(bits);
}
const rid = (n = 12) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const monthKey = (t = Date.now()) => new Date(t + 5.5 * 36e5).toISOString().slice(0, 7); // IST month
const getJSON = async (env, k, d = null) => { const v = await env.DB.get(k); return v ? JSON.parse(v) : d; };
const putJSON = (env, k, v, opt) => env.DB.put(k, JSON.stringify(v), opt);
const validId = id => /^[A-Z0-9_]{3,20}$/.test(id || '');

function subStatus(c, now = Date.now()) {
  if (c.status === 'paused') return { state: 'paused', usable: false, daysLeft: 0, paidUntil: c.paidUntil || 0 };
  const until = c.paidUntil || 0, grace = (c.graceDays ?? 3) * DAY;
  if (now < until) { const d = Math.ceil((until - now) / DAY); return { state: d <= 5 ? 'due' : 'active', usable: true, daysLeft: d, paidUntil: until }; }
  if (now < until + grace) return { state: 'grace', usable: true, daysLeft: 0, graceLeft: Math.ceil((until + grace - now) / DAY), paidUntil: until };
  return { state: 'expired', usable: false, daysLeft: 0, paidUntil: until };
}
async function usage(env, id) { return getJSON(env, `usage:${id}:${monthKey()}`, { chars: 0, reels: 0, lines: 0 }); }
function publicClient(c, u, hasKey) {
  return {
    id: c.id, name: c.name, phone: c.phone, tagline: c.tagline, main: c.main, accent: c.accent, credit: c.credit,
    logo: c.logo || '', lang: c.lang || 'en', template: c.template || 'card', brandOnly: !!c.brandOnly, planAmount: c.planAmount || 0,
    plan: c.plan || 'basic', planName: (PLANS[c.plan] || PLANS.basic).name, extras: (PLANS[c.plan] || PLANS.basic).extras,
    reelLimit: c.reelLimit || 0, charLimit: c.charLimit || 0, aiVoice: !!c.aiVoice, voiceEnabled: !!(c.aiVoice && c.voiceId && hasKey), usage: u,
    sub: subStatus(c), payOnline: true, support: c.support || ''
  };
}
async function clientKey(env, id) { return (await env.DB.get(`key:${id}`)) || (await env.DB.get('key:_default')) || env.ELEVEN_KEY || ''; }
async function addPaymentLog(env, id, entry) { const k = `payments:${id}`; const l = await getJSON(env, k, []); l.unshift(entry); await putJSON(env, k, l.slice(0, 60)); }

/* ---------------- router ---------------- */
async function route(req, env) {
  const url = new URL(req.url), p = url.pathname.replace(/\/+$/, ''), m = req.method;
  const body = async () => { try { return await req.json(); } catch (e) { return {}; } };

  if (p === '' || p === '/api' || p === '/api/health') return json({ ok: true, service: 'reel-api', mock: env.MOCK_TTS === '1' });

  /* ---------- client auth ---------- */
  if (p === '/api/login' && m === 'POST') {
    const { code, pin } = await body(); const id = String(code || '').trim().toUpperCase();
    if (!validId(id) || !pin) fail('Enter your client code and PIN.');
    const rlk = `rl:${id}`, tries = +(await env.DB.get(rlk) || 0);
    if (tries >= 8) fail('Too many wrong attempts. Try again in 15 minutes.', 429);
    const c = await getJSON(env, `client:${id}`);
    if (!c || !c.pinHash || !safeEq(await hashPin(String(pin), c.pinSalt), c.pinHash)) { await env.DB.put(rlk, String(tries + 1), { expirationTtl: 900 }); fail('Wrong client code or PIN.', 401); }
    await env.DB.delete(rlk);
    const token = await signToken(env, { sub: 'client', id, v: c.pinVer || 1, exp: Date.now() + 30 * DAY });
    return json({ token, client: publicClient(c, await usage(env, id), !!(await clientKey(env, id))) });
  }

  if (p.startsWith('/api/pay/webhook') && m === 'POST') return cashfreeWebhook(req, env);

  if (p.startsWith('/api/admin')) return adminRoute(req, env, p, m, body);

  /* ---------- client (logged in) ---------- */
  const tok = await readToken(env, req);
  if (!tok || tok.sub !== 'client') fail('Please log in again.', 401);
  const c = await getJSON(env, `client:${tok.id}`);
  if (!c || (c.pinVer || 1) !== tok.v) fail('Please log in again.', 401);
  const st = subStatus(c);

  if (p === '/api/me' && m === 'GET') return json({ client: publicClient(c, await usage(env, c.id), !!(await clientKey(env, c.id))) });

  if (p === '/api/reel-start' && m === 'POST') {
    if (!st.usable) fail('Your subscription has expired. Please renew to create videos.', 402);
    const u = await usage(env, c.id);
    if (c.reelLimit && u.reels >= c.reelLimit) fail(`Monthly limit reached (${c.reelLimit} reels). Contact Think Through Technology to add more.`, 402);
    u.reels++; await putJSON(env, `usage:${c.id}:${monthKey()}`, u);
    return json({ ok: true, usage: u });
  }

  if (p === '/api/tts' && m === 'POST') {
    if (!st.usable) fail('Your subscription has expired. Please renew to use AI voice.', 402);
    const { text } = await body(); const t = String(text || '').trim();
    if (!t) fail('Empty voice line.'); if (t.length > 700) fail('Voice line is too long (max 700 characters).');
    if (!c.aiVoice) fail('AI voice is not included in your plan. Record or upload your voice, or upgrade to Standard.', 403);
    if (!c.voiceId) fail('AI voice is not set up for your account yet.', 403);
    const u = await usage(env, c.id);
    if (c.charLimit && u.chars + t.length > c.charLimit) fail('Monthly AI voice limit reached. You can still record or upload your own voice.', 402);
    let audio, type = 'audio/mpeg';
    if (env.MOCK_TTS === '1') { audio = mockWav(t); type = 'audio/wav'; }
    else {
      const key = await clientKey(env, c.id); if (!key) fail('AI voice is not set up for your account yet.', 403);
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(c.voiceId)}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: t, model_id: c.model || 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } })
      });
      if (!r.ok) { let msg = 'Voice service error ' + r.status; try { const j = await r.json(); msg = (j.detail && (j.detail.message || j.detail.status)) || msg; } catch (e) { } fail(msg, 502); }
      audio = await r.arrayBuffer();
    }
    u.chars += t.length; u.lines++; await putJSON(env, `usage:${c.id}:${monthKey()}`, u);
    return new Response(audio, { headers: { 'content-type': type, 'x-usage-chars': String(u.chars), 'Access-Control-Expose-Headers': 'x-usage-chars' } });
  }

  if (p === '/api/pay/create' && m === 'POST') {
    if (!c.planAmount) fail('Online payment is not set up for your account. Please contact us.', 400);
    if (!env.CF_APP_ID || !env.CF_SECRET) fail('Online payment is not configured yet. Please contact us.', 503);
    const { returnUrl } = await body();
    const ret = safeReturn(env, returnUrl);
    const orderId = `TTT_${c.id}_${Date.now()}`;
    const phone = String(c.billingPhone || c.phone || '').replace(/\D/g, '').slice(-10);
    const r = await cf(env, 'POST', '/pg/orders', {
      order_id: orderId, order_amount: Number(c.planAmount), order_currency: 'INR', order_note: `Reel Maker 30 days - ${c.name}`,
      customer_details: { customer_id: c.id, customer_name: c.name || c.id, customer_phone: phone || '9999999999', ...(c.billingEmail ? { customer_email: c.billingEmail } : {}) },
      order_meta: { return_url: ret + (ret.includes('?') ? '&' : '?') + 'order_id={order_id}', notify_url: new URL('/api/pay/webhook', req.url).toString() }
    });
    await putJSON(env, `pay:${orderId}`, { clientId: c.id, amount: Number(c.planAmount), status: 'CREATED', at: Date.now() });
    return json({ orderId, paymentSessionId: r.payment_session_id, mode: env.CF_ENV === 'sandbox' ? 'sandbox' : 'production' });
  }

  if (p === '/api/pay/verify' && m === 'GET') {
    const orderId = url.searchParams.get('order_id') || '';
    const rec = await getJSON(env, `pay:${orderId}`); if (!rec || rec.clientId !== c.id) fail('Order not found.', 404);
    if (!rec.processed) {
      const o = await cf(env, 'GET', `/pg/orders/${encodeURIComponent(orderId)}`);
      if (o.order_status === 'PAID') await applyPayment(env, orderId, 'Cashfree');
      else return json({ status: o.order_status || 'PENDING' });
    }
    const c2 = await getJSON(env, `client:${c.id}`);
    return json({ status: 'PAID', client: publicClient(c2, await usage(env, c.id), !!(await clientKey(env, c.id))) });
  }

  fail('Not found', 404);
}

function safeReturn(env, u) {
  const fallback = env.APP_URL || '';
  try { const x = new URL(u); const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
    if (allowed.includes('*') || allowed.includes(x.origin)) return x.origin + x.pathname; } catch (e) { }
  if (!fallback) fail('Return URL not allowed.'); return fallback;
}

/* ---------------- Cashfree ---------------- */
async function cf(env, method, path, payload) {
  const base = env.CF_ENV === 'sandbox' ? 'https://sandbox.cashfree.com' : 'https://api.cashfree.com';
  const r = await fetch(base + path, { method, headers: { 'x-client-id': env.CF_APP_ID, 'x-client-secret': env.CF_SECRET, 'x-api-version': '2023-08-01', 'content-type': 'application/json', accept: 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) fail('Payment service: ' + (j.message || r.status), 502);
  return j;
}
async function applyPayment(env, orderId, method) {
  const rec = await getJSON(env, `pay:${orderId}`); if (!rec || rec.processed) return false;
  const c = await getJSON(env, `client:${rec.clientId}`); if (!c) return false;
  const now = Date.now(), base = Math.max(now, c.paidUntil || 0);
  c.paidUntil = base + PERIOD_DAYS * DAY; c.shootDone = false; if (c.status === 'paused') c.status = 'active';
  rec.processed = true; rec.status = 'PAID'; rec.paidAt = now;
  await putJSON(env, `client:${c.id}`, c); await putJSON(env, `pay:${orderId}`, rec);
  await addPaymentLog(env, c.id, { at: now, amount: rec.amount, method, ref: orderId, until: c.paidUntil });
  return true;
}
async function cashfreeWebhook(req, env) {
  const raw = await req.text(), ts = req.headers.get('x-webhook-timestamp') || '', sig = req.headers.get('x-webhook-signature') || '';
  if (!env.CF_SECRET) fail('Payments not configured', 503);
  const expect = btoa(String.fromCharCode(...new Uint8Array(await hmac(env.CF_SECRET || '', ts + raw, true))));
  if (!safeEq(sig, expect)) fail('Bad signature', 401);
  const j = JSON.parse(raw || '{}'), d = j.data || {};
  const orderId = d.order && d.order.order_id, ok = d.payment && d.payment.payment_status === 'SUCCESS';
  if (orderId && ok) await applyPayment(env, orderId, 'Cashfree');
  return json({ ok: true });
}

/* ---------------- admin ---------------- */
async function adminRoute(req, env, p, m, body) {
  if (p === '/api/admin/login' && m === 'POST') {
    const { password } = await body();
    const tries = +(await env.DB.get('rl:_admin') || 0); if (tries >= 10) fail('Too many attempts. Wait 15 minutes.', 429);
    if (!env.ADMIN_PASSWORD || !safeEq(String(password || ''), env.ADMIN_PASSWORD)) { await env.DB.put('rl:_admin', String(tries + 1), { expirationTtl: 900 }); fail('Wrong password.', 401); }
    await env.DB.delete('rl:_admin');
    return json({ token: await signToken(env, { sub: 'admin', exp: Date.now() + 7 * DAY }) });
  }
  const tok = await readToken(env, req); if (!tok || tok.sub !== 'admin') fail('Admin login required.', 401);

  if (p === '/api/admin/settings' && m === 'GET') {
    const dk = await env.DB.get('key:_default') || env.ELEVEN_KEY || '';
    return json({ plans: PLANS, hasDefaultKey: !!dk, defaultKeyLast4: dk ? dk.slice(-4) : '', cashfree: !!(env.CF_APP_ID && env.CF_SECRET), cfEnv: env.CF_ENV || 'production', mock: env.MOCK_TTS === '1', appUrl: env.APP_URL || '' });
  }
  if (p === '/api/admin/default-key' && m === 'POST') {
    const { key } = await body(); if (key) await env.DB.put('key:_default', String(key).trim()); else await env.DB.delete('key:_default');
    return json({ ok: true });
  }
  if (p === '/api/admin/clients' && m === 'GET') {
    const out = []; let cursor;
    do { const l = await env.DB.list({ prefix: 'client:', cursor }); cursor = l.list_complete ? null : l.cursor;
      for (const k of l.keys) { const c = await getJSON(env, k.name); if (!c) continue; const { pinHash, pinSalt, ...safe } = c;
        out.push({ ...safe, sub: subStatus(c), usage: await usage(env, c.id), hasOwnKey: !!(await env.DB.get(`key:${c.id}`)) }); }
    } while (cursor);
    out.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    return json({ clients: out });
  }
  if (p === '/api/admin/clients' && m === 'POST') {
    const b = await body(); const id = String(b.id || '').trim().toUpperCase(); if (!validId(id)) fail('Client code must be 3–20 letters/numbers (e.g. RKREAL).');
    const prev = await getJSON(env, `client:${id}`); if (b.isNew && prev) fail('This client code already exists.');
    const fields = ['plan', 'name', 'phone', 'tagline', 'main', 'accent', 'credit', 'logo', 'lang', 'template', 'voiceId', 'model', 'billingPhone', 'billingEmail', 'notes', 'status', 'support'];
    const c = prev || { id, createdAt: Date.now(), paidUntil: 0, status: 'active', pinVer: 1 };
    for (const f of fields) if (b[f] !== undefined) c[f] = typeof b[f] === 'string' ? b[f].slice(0, f === 'logo' ? 400000 : 2000) : b[f];
    if (b.plan && PLANS[b.plan] && (b.applyPlanDefaults || !prev)) { const P = PLANS[b.plan]; c.planAmount = P.amount; c.reelLimit = P.reels; c.charLimit = P.chars; c.aiVoice = P.aiVoice; }
    if (typeof b.aiVoice === 'boolean') c.aiVoice = b.aiVoice;
    if (typeof b.brandOnly === 'boolean') c.brandOnly = b.brandOnly;
    if (!c.plan) c.plan = 'basic';
    if (b.shootDone !== undefined) c.shootDone = !!b.shootDone;
    for (const f of ['planAmount', 'reelLimit', 'charLimit', 'graceDays']) if (b[f] !== undefined && b[f] !== '') c[f] = Math.max(0, Number(b[f]) || 0);
    let newPin = null;
    if (b.pin || !prev) { newPin = String(b.pin || Math.floor(100000 + Math.random() * 900000)); if (!/^\d{4,8}$/.test(newPin)) fail('PIN must be 4–8 digits.');
      c.pinSalt = rid(); c.pinHash = await hashPin(newPin, c.pinSalt); c.pinVer = (c.pinVer || 0) + (prev ? 1 : 0) || 1; }
    if (!prev && b.trialDays) c.paidUntil = Date.now() + Number(b.trialDays) * DAY;
    await putJSON(env, `client:${id}`, c);
    return json({ ok: true, id, pin: newPin });
  }
  const mm = p.match(/^\/api\/admin\/clients\/([A-Z0-9_]+)(?:\/(\w[\w-]*))?$/);
  if (mm) {
    const [, id, action] = mm; const c = await getJSON(env, `client:${id}`); if (!c) fail('Client not found.', 404);
    if (!action && m === 'DELETE') { for (const k of [`client:${id}`, `key:${id}`, `payments:${id}`]) await env.DB.delete(k); return json({ ok: true }); }
    if (action === 'key' && m === 'POST') { const { key } = await body(); if (key) { await env.DB.put(`key:${id}`, String(key).trim()); c.keyLast4 = String(key).trim().slice(-4); } else { await env.DB.delete(`key:${id}`); c.keyLast4 = ''; } await putJSON(env, `client:${id}`, c); return json({ ok: true }); }
    if (action === 'extend' && m === 'POST') {
      const { days = PERIOD_DAYS, amount = 0, method = 'Manual', note = '' } = await body(); const now = Date.now();
      c.paidUntil = Math.max(now, c.paidUntil || 0) + Number(days) * DAY; c.shootDone = false; if (c.status === 'paused') c.status = 'active';
      await putJSON(env, `client:${id}`, c); await addPaymentLog(env, id, { at: now, amount: Number(amount) || 0, method, note, until: c.paidUntil, days: Number(days) });
      return json({ ok: true, paidUntil: c.paidUntil, sub: subStatus(c) });
    }
    if (action === 'set-until' && m === 'POST') { const { until } = await body(); c.paidUntil = Number(until) || 0; await putJSON(env, `client:${id}`, c); await addPaymentLog(env, id, { at: Date.now(), amount: 0, method: 'Date changed', until: c.paidUntil }); return json({ ok: true, sub: subStatus(c) }); }
    if (action === 'payments' && m === 'GET') return json({ payments: await getJSON(env, `payments:${id}`, []) });
    if (action === 'reset-usage' && m === 'POST') { await env.DB.delete(`usage:${id}:${monthKey()}`); return json({ ok: true }); }
    if (action === 'logout-all' && m === 'POST') { c.pinVer = (c.pinVer || 1) + 1; await putJSON(env, `client:${id}`, c); return json({ ok: true }); }
    if (action === 'clone' && m === 'POST') {
      // Instant Voice Clone via ElevenLabs. Admin only. Consent is required and stored with the client.
      const fd = await req.formData(); const files = fd.getAll('files').filter(f => f && typeof f === 'object' && f.size);
      if (!files.length) fail('Add at least one recording.');
      if (fd.get('consent') !== 'yes') fail("Confirm you have the person's permission to clone their voice.");
      const total = files.reduce((a, f) => a + f.size, 0); if (total > 60 * 1024 * 1024) fail('Recordings are too large (max 60 MB). Use shorter takes.');
      let voiceId, needsVerify = false;
      if (env.MOCK_TTS === '1') voiceId = 'mock_' + rid(6);
      else {
        const key = await clientKey(env, id); if (!key) fail('No ElevenLabs key saved. Add it in ⚙ Settings first.');
        const out = new FormData();
        out.append('name', `${c.name || id} (${id})`.slice(0, 90));
        out.append('description', `Property Reel Maker clone for ${c.name || id}. Consent: ${String(fd.get('consentNote') || '').slice(0, 300)}`);
        out.append('remove_background_noise', fd.get('denoise') === 'yes' ? 'true' : 'false');
        out.append('labels', JSON.stringify({ language: fd.get('lang') === 'en' ? 'en' : 'ta', accent: 'indian' }));
        files.forEach((f, i) => out.append('files', f, f.name || `sample-${i + 1}.wav`));
        const r = await fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': key }, body: out });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) fail('ElevenLabs: ' + ((j.detail && (j.detail.message || j.detail.status)) || ('error ' + r.status)), 502);
        voiceId = j.voice_id; needsVerify = !!j.requires_verification;
      }
      const old = c.clonedVoiceId || '';
      c.voiceId = voiceId; c.clonedVoiceId = voiceId;
      c.clone = { at: Date.now(), consent: String(fd.get('consentNote') || '').slice(0, 300), seconds: Number(fd.get('seconds')) || 0, needsVerify };
      await putJSON(env, `client:${id}`, c);
      if (old && old !== voiceId && fd.get('replace') === 'yes' && env.MOCK_TTS !== '1') {
        const key = await clientKey(env, id); try { await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(old)}`, { method: 'DELETE', headers: { 'xi-api-key': key } }); } catch (e) { }
      }
      return json({ ok: true, voiceId, needsVerify, replaced: old });
    }
    if (action === 'clone-delete' && m === 'POST') {
      const vid = c.clonedVoiceId; if (!vid) fail('This client has no cloned voice.');
      if (env.MOCK_TTS !== '1') {
        const key = await clientKey(env, id); if (!key) fail('No ElevenLabs key saved.');
        const r = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(vid)}`, { method: 'DELETE', headers: { 'xi-api-key': key } });
        if (!r.ok && r.status !== 404) { let msg = 'ElevenLabs error ' + r.status; try { const j = await r.json(); msg = (j.detail && (j.detail.message || j.detail.status)) || msg; } catch (e) { } fail(msg, 502); }
      }
      if (c.voiceId === vid) c.voiceId = ''; c.clonedVoiceId = ''; c.clone = null;
      await putJSON(env, `client:${id}`, c); return json({ ok: true });
    }
    if (action === 'test-voice' && m === 'POST') {
      const { text } = await body(); if (!c.voiceId) fail('Set a Voice ID first.');
      if (env.MOCK_TTS === '1') return new Response(mockWav(text || 'test'), { headers: { 'content-type': 'audio/wav' } });
      const key = await clientKey(env, id); if (!key) fail('No ElevenLabs key saved for this client or as default.');
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(c.voiceId)}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ text: String(text || 'Vanakkam! This is a voice test.').slice(0, 300), model_id: c.model || 'eleven_multilingual_v2' }) });
      if (!r.ok) { let msg = 'ElevenLabs error ' + r.status; try { const j = await r.json(); msg = (j.detail && (j.detail.message || j.detail.status)) || msg; } catch (e) { } fail(msg, 502); }
      return new Response(await r.arrayBuffer(), { headers: { 'content-type': 'audio/mpeg' } });
    }
  }
  fail('Not found', 404);
}

/* ---------------- test helper: fake voice (MOCK_TTS=1 only) ---------------- */
function mockWav(text) {
  const sr = 22050, dur = Math.min(8, 0.8 + text.length * 0.055), n = Math.floor(sr * dur), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const t = i / sr, env = Math.min(1, t * 20, (dur - t) * 20) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 3.3 * t)); v.setInt16(44 + i * 2, Math.round(9000 * env * Math.sin(2 * Math.PI * (180 + 40 * Math.sin(t * 5)) * t)), true); }
  return buf;
}
