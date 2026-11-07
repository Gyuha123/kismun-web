// Vote server. The only thing that writes votes or changes the session.
//
// Browsers send POST application/json {action, ...} from this site only.
// Codes are never stored in clear: each country's code is kept as an HMAC
// keyed with a secret pepper, so the environment alone cannot reveal them.
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   FIREBASE_SERVICE_ACCOUNT   service-account JSON (Firebase console)
//   CODE_PEPPER                random secret (64 hex characters)
//   DESK_PASSWORD_SCRYPT       "saltHex:hashHex" of the desk password (scrypt)

const crypto = require('crypto');

const DB = 'https://kismun-placard-default-rtdb.asia-southeast1.firebasedatabase.app';
const SITE_HOST_ANY = true;        // origin must match the host this function was called on
const CHOICES = ['for', 'against', 'abstain'];
const DESK_ACTIONS = ['auth', 'set_topic', 'open', 'close', 'reset_votes', 'unblock_all'];

// limits
const MAX_BODY_BYTES = 2048;
const IP_MAX_FAILS = 5;                 // per network: blocks after 5 wrong codes (kept as requested)
const DESK_MAX_FAILS = 5;               // per network, wrong desk passwords
const DESK_LOCK_MS = 15 * 60 * 1000;
const TOPIC_MAX = 120;

let tokenCache = { token: null, exp: 0 };

function json(status, obj) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    body: JSON.stringify(obj)
  };
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sanitizeKey(name) {
  return String(name).replace(/[.#$\[\]\/]/g, '_');
}

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), 'hex');
  const y = Buffer.from(String(b), 'hex');
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

function codeHash(country, code) {
  const pepper = process.env.CODE_PEPPER || '';
  // 128-bit truncation keeps the environment value under Netlify's 5000-character limit
  return crypto.createHmac('sha256', pepper).update(country + '|' + code).digest('hex').slice(0, 32);
}

// Country -> keyed hash. Stored in code-hashes.json (safe to publish: each value is an
// HMAC keyed with CODE_PEPPER, which is the secret). PLACARD_CODE_HASHES, if set, overrides it.
function hashMap() {
  if (process.env.PLACARD_CODE_HASHES) {
    try { return JSON.parse(process.env.PLACARD_CODE_HASHES); } catch (e) { return {}; }
  }
  try { return require('./code-hashes.json'); } catch (e) { return {}; }
}

// Always computes an HMAC, so unknown countries take the same time.
function codeMatches(country, code) {
  const map = hashMap();
  const known = Object.prototype.hasOwnProperty.call(map, country);
  const computed = codeHash(country, code);
  return known && safeEqualHex(computed, map[country]);
}

function knownCountry(country) {
  return Object.prototype.hasOwnProperty.call(hashMap(), country);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function accessToken() {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60000) return tokenCache.token;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(header + '.' + claim);
  const sig = b64url(signer.sign(sa.private_key));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: header + '.' + claim + '.' + sig
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('token');
  tokenCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

async function rtdb(method, path, body, headers) {
  const token = await accessToken();
  return fetch(DB + '/' + path + '.json?access_token=' + encodeURIComponent(token), {
    method: method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function read(path) {
  const res = await rtdb('GET', path);
  if (!res.ok) throw new Error('read');
  return res.json();
}

// Compare-and-set on one path. mutate(current) returns {write, value, result}.
// The write only lands if nothing changed the path since it was read, so two
// simultaneous votes for one country cannot both be stored.
async function update(path, mutate) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const got = await rtdb('GET', path, undefined, { 'X-Firebase-ETag': 'true' });
    if (!got.ok) throw new Error('read');
    const etag = got.headers.get('etag');
    const current = await got.json();
    const next = mutate(current);
    if (!next.write) return next.result;
    const put = await rtdb('PUT', path, next.value, { 'if-match': current === null ? 'null_etag' : etag });
    if (put.status === 412) continue;
    if (!put.ok) throw new Error('write');
    return next.result;
  }
  throw new Error('busy');
}

function clientIp(event) {
  const raw = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  return String(raw).split(',')[0].trim();
}

// Only requests from this site's own pages are accepted.
function fromThisSite(event) {
  const origin = event.headers.origin;
  if (!origin) return SITE_HOST_ANY; // non-browser tools send no Origin; they still need the codes
  try { return new URL(origin).host === event.headers.host; } catch (e) { return false; }
}

// The audit trail must never block or undo a desk action, so failures are ignored.
async function audit(action, ipHash) {
  try {
    await rtdb('POST', 'security/log', { a: action, ip: ipHash.slice(0, 12), t: { '.sv': 'timestamp' } });
  } catch (e) { /* ignored on purpose */ }
}

async function ipBlocked(ipHash) {
  const rec = await read('security/ip/' + ipHash);
  return !!(rec && rec.blocked);
}

async function recordIpFailure(ipHash) {
  return update('security/ip/' + ipHash, function (cur) {
    const fails = ((cur && cur.fails) || 0) + 1;
    return { write: true, value: { fails: fails, blocked: fails >= IP_MAX_FAILS }, result: { fails: fails } };
  });
}

async function deskLocked(ipHash) {
  const rec = await read('security/desk/' + ipHash);
  return !!(rec && rec.lockedUntil && rec.lockedUntil > Date.now());
}

async function recordDeskFailure(ipHash) {
  return update('security/desk/' + ipHash, function (cur) {
    const fails = ((cur && cur.fails) || 0) + 1;
    const lock = fails >= DESK_MAX_FAILS;
    return { write: true, value: { fails: lock ? 0 : fails, lockedUntil: lock ? Date.now() + DESK_LOCK_MS : 0 }, result: {} };
  });
}

function cleanTopic(raw) {
  return String(raw || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TOPIC_MAX);
}

// scrypt is deliberately slow and memory-hungry, so guessing offline is costly.
function deskPasswordOk(password) {
  const [saltHex, hashHex] = String(process.env.DESK_PASSWORD_SCRYPT || '').split(':');
  if (!saltHex || !hashHex) return false;
  const computed = crypto.scryptSync(String(password || ''), Buffer.from(saltHex, 'hex'), 64);
  const want = Buffer.from(hashHex, 'hex');
  return want.length === computed.length && crypto.timingSafeEqual(computed, want);
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  if (!fromThisSite(event)) return json(403, { error: 'origin' });

  const type = String((event.headers['content-type'] || '')).toLowerCase();
  if (type.indexOf('application/json') !== 0) return json(415, { error: 'content-type' });
  if (String(event.body || '').length > MAX_BODY_BYTES) return json(413, { error: 'too-large' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad-json' }); }
  if (!body || typeof body !== 'object') return json(400, { error: 'bad-json' });

  const action = String(body.action || '');
  const ipHash = sha256Hex((process.env.IP_SALT || 'kismun-ip') + clientIp(event));

  // a small, fixed-ish delay on every request slows down scripted guessing
  await sleep(80 + Math.floor(Math.random() * 120));

  try {
    // ---- voter actions --------------------------------------------------
    if (action === 'check' || action === 'vote' || action === 'placard') {
      if (await ipBlocked(ipHash)) return json(200, { error: 'blocked' });

      const country = String(body.country || '');
      const code = String(body.code || '');
      if (!/^\d{4}$/.test(code)) return json(200, { error: 'format' });

      const key = sanitizeKey(country);

      const valid = knownCountry(country) && codeMatches(country, code);
      if (!valid) {
        // unknown countries are counted exactly like wrong codes, so they cannot be probed
        const ip = await recordIpFailure(ipHash);
        return json(200, { error: ip.fails >= IP_MAX_FAILS ? 'blocked' : 'wrong' });
      }

      const session = (await read('session')) || {};
      const open = !!session.open;
      const topic = session.topic || '';

      if (action === 'check') {
        const existing = await read('votes/' + key);
        const raised = await read('session/placard/' + key);
        return json(200, { ok: true, topic: topic, open: open, voted: existing ? existing.choice : null, placardRaised: !!raised });
      }

      // Raise Placard: one per unit per round. It does not depend on voting being open.
      if (action === 'placard') {
        const result = await update('session/placard/' + key, function (cur) {
          if (cur) return { write: false, result: { error: 'already' } };
          return { write: true, value: { t: { '.sv': 'timestamp' } }, result: { ok: true } };
        });
        return json(200, result);
      }

      if (CHOICES.indexOf(body.choice) === -1) return json(200, { error: 'choice' });
      if (!open) return json(200, { error: 'closed' });

      const result = await update('votes/' + key, function (cur) {
        if (cur) return { write: false, result: { error: 'already', choice: cur.choice } };
        return {
          write: true,
          value: { choice: body.choice, country: country, t: { '.sv': 'timestamp' } },
          result: { ok: true, choice: body.choice }
        };
      });
      return json(200, result);
    }

    // ---- desk actions: password, with its own lock per network -----------
    if (DESK_ACTIONS.indexOf(action) !== -1) {
      if (await deskLocked(ipHash)) return json(200, { error: 'locked' });
      if (!deskPasswordOk(body.password)) {
        await recordDeskFailure(ipHash);
        return json(200, { error: 'password' });
      }
      if (action === 'auth') return json(200, { ok: true });


      if (action === 'set_topic') {
        await rtdb('PATCH', 'session', { topic: cleanTopic(body.topic) });
      } else if (action === 'open' || action === 'close') {
        await rtdb('PATCH', 'session', { open: action === 'open' });
      } else if (action === 'reset_votes') {
        await rtdb('DELETE', 'votes');
        await rtdb('DELETE', 'session/placard');
      } else if (action === 'unblock_all') {
        await rtdb('DELETE', 'security/ip');
      }
      await audit(action, ipHash);
      return json(200, { ok: true });
    }

    return json(400, { error: 'unknown-action' });
  } catch (err) {
    return json(500, { error: 'server' });
  }
};

// used by the local tests only
exports._internal = { sha256Hex: sha256Hex, sanitizeKey: sanitizeKey, codeHash: codeHash, cleanTopic: cleanTopic };
