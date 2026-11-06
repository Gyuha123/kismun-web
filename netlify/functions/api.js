// Vote server. The only thing that writes votes or changes the session.
// Browsers talk to it with POST {action, ...}. It checks the 4-digit country
// code, counts failed attempts per network (blocking after 5), and writes to
// the Firebase Realtime Database as a service account.
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   PLACARD_CODES             JSON object {"SYRIA":"1234", ...}
//   FIREBASE_SERVICE_ACCOUNT  the service-account JSON from Firebase

const crypto = require('crypto');

const DB = 'https://kismun-placard-default-rtdb.asia-southeast1.firebasedatabase.app';
const ADMIN_SHA256 = '31ffc5f32537c7f67c787bf32e27a2d8aeac8efd2ad86f1ae4fd586369cab37e';
const IP_SALT = 'kismun-2026-ip';
const MAX_FAILS = 5;
const CHOICES = ['for', 'against', 'abstain'];

let tokenCache = { token: null, exp: 0 };

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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

function codeMap() {
  return JSON.parse(process.env.PLACARD_CODES || '{}');
}

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
// simultaneous votes for the same country cannot both be stored.
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

async function isBlocked(ipHash) {
  const rec = await read('security/ip/' + ipHash);
  return !!(rec && rec.blocked);
}

async function recordFailure(ipHash) {
  return update('security/ip/' + ipHash, function (cur) {
    const fails = ((cur && cur.fails) || 0) + 1;
    return { write: true, value: { fails: fails, blocked: fails >= MAX_FAILS }, result: { fails: fails } };
  });
}

async function sessionState() {
  const s = (await read('session')) || {};
  return { open: !!s.open, topic: s.topic || '' };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad-json' }); }

  const ipHash = sha256Hex(IP_SALT + clientIp(event));
  const action = String(body.action || '');

  try {
    // ---- voter actions: check the country code, then show the choices / vote
    if (action === 'check' || action === 'vote') {
      if (await isBlocked(ipHash)) return json(200, { error: 'blocked' });

      const country = String(body.country || '');
      const expected = codeMap()[country];
      if (!expected) return json(200, { error: 'unknown-country' });
      if (!/^\d{4}$/.test(String(body.code || ''))) return json(200, { error: 'format' });

      if (String(body.code) !== String(expected)) {
        const failed = await recordFailure(ipHash);
        return json(200, { error: failed.fails >= MAX_FAILS ? 'blocked' : 'wrong' });
      }

      const key = sanitizeKey(country);
      const state = await sessionState();

      if (action === 'check') {
        const existing = await read('votes/' + key);
        return json(200, {
          ok: true,
          topic: state.topic,
          open: state.open,
          voted: existing ? existing.choice : null
        });
      }

      if (!CHOICES.includes(body.choice)) return json(200, { error: 'choice' });
      if (!state.open) return json(200, { error: 'closed' });

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

    // ---- desk actions: every one needs the desk password
    const deskActions = ['auth', 'set_topic', 'open', 'close', 'reset_votes', 'unblock_all'];
    if (deskActions.indexOf(action) !== -1) {
      if (sha256Hex(String(body.password || '')) !== ADMIN_SHA256) return json(200, { error: 'password' });
      if (action === 'auth') return json(200, { ok: true });
      if (action === 'set_topic') {
        await rtdb('PATCH', 'session', { topic: String(body.topic || '').slice(0, 200) });
      } else if (action === 'open' || action === 'close') {
        await rtdb('PATCH', 'session', { open: action === 'open' });
      } else if (action === 'reset_votes') {
        await rtdb('DELETE', 'votes');
      } else if (action === 'unblock_all') {
        await rtdb('DELETE', 'security/ip');
      }
      return json(200, { ok: true });
    }

    return json(400, { error: 'unknown-action' });
  } catch (err) {
    return json(500, { error: 'server' });
  }
};

// used by the local tests only
exports._internal = { sha256Hex: sha256Hex, sanitizeKey: sanitizeKey, MAX_FAILS: MAX_FAILS };
