// oauth/huawei.js
const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');
const { jwtDecode } = require('jwt-decode'); // v4+ import

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

const { HUAWEI_ID, HUAWEI_SECRET } = process.env;

// in-memory map state -> { redirect, ts }
// NOTE: this is a simple approach. For multi-instance deployments you will want a shared store (redis, db).
const stateRedirectMap = new Map();
const STATE_TTL_MS = 10 * 60 * 1000; // keep for 10 minutes

// periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of stateRedirectMap.entries()) {
    if (now - v.ts > STATE_TTL_MS) stateRedirectMap.delete(k);
  }
}, 60 * 1000).unref();

module.exports = class extends Base {
  static check() {
    return HUAWEI_ID && HUAWEI_SECRET;
  }

  static info() {
    return { origin: new URL(OAUTH_URL).hostname };
  }

  /**
   * AUTHORIZE: invoked when Waline starts login and hits:
   *   GET /huawei?redirect=<waline>&state=<walineState>
   *
   * We must:
   *  - remember redirect keyed by state
   *  - call Huawei with redirect_uri = /huawei?redirect=<waline>  (so browser returns to waline)
   */
  async redirect() {
    let { redirect, state } = this.ctx.params;
    console.log('\n[Huawei] ===== AUTHORIZE START =====');
    console.log('[Huawei] incoming redirect (waline):', redirect);
    console.log('[Huawei] incoming state:', state, 'type:', typeof state);

    // coerce state to string
    state = Array.isArray(state) ? state[0] : (state === undefined ? '' : String(state));

    if (redirect) {
      // store mapping so server->server token exchange can reuse identical redirect_uri
      stateRedirectMap.set(state, { redirect: String(redirect), ts: Date.now() });
      console.log('[Huawei] saved state->redirect mapping for state:', state);
    } else {
      console.log('[Huawei] WARNING: authorize called without redirect param');
    }

    // **Important**: redirect_uri we give to Huawei must include the same `redirect` param
    // so that when Huawei redirects back to our /huawei endpoint the browser will get forwarded to Waline.
    const redirect_uri = this.getCompleteUrl('/huawei') + (redirect ? ('?' + qs.stringify({ redirect })) : '');

    console.log('[Huawei] calling authorize with redirect_uri:', redirect_uri);

    const authorizeUrl = OAUTH_URL + '?' + qs.stringify({
      client_id: HUAWEI_ID,
      redirect_uri,
      response_type: 'code',
      scope: 'openid profile email',
      state
    });

    console.log('[Huawei] Final authorize URL:', authorizeUrl);
    console.log('[Huawei] ===== AUTHORIZE END =====\n');

    return this.ctx.redirect(authorizeUrl);
  }

  /**
   * TOKEN: exchange code -> tokens.
   * The incoming server-to-server request from Waline (oauth.js) will call:
   *   GET /huawei?code=...&state=...
   * with NO redirect param.
   *
   * We must reconstruct the same redirect_uri used during authorize:
   *   this.getCompleteUrl('/huawei') + '?redirect=<waline>'
   * We look up <waline> from stateRedirectMap (saved earlier).
   */
  async getAccessToken(code) {
    // state might be present in params (server-to-server call includes it)
    let { state, redirect } = this.ctx.params;
    console.log('\n[Huawei] ===== TOKEN START =====');
    console.log('[Huawei] Received code:', typeof code === 'string' ? '[long code]' : code);
    state = Array.isArray(state) ? state[0] : (state === undefined ? '' : String(state));
    redirect = Array.isArray(redirect) ? redirect[0] : (redirect === undefined ? undefined : String(redirect));
    console.log('[Huawei] Received state:', state);
    console.log('[Huawei] Received redirect param (may be undefined in server->server):', redirect);

    // find redirect: 1) use redirect param if present; 2) else lookup saved mapping by state
    let walineRedirect = redirect;
    if (!walineRedirect && state) {
      const rec = stateRedirectMap.get(state);
      if (rec && rec.redirect) {
        walineRedirect = rec.redirect;
        console.log('[Huawei] looked up waline redirect from map for state:', state, '->', walineRedirect);
      } else {
        console.log('[Huawei] WARNING: no stored redirect for state:', state);
      }
    }

    // Build redirect_uri for token exchange — MUST be exactly the same as authorize.
    const redirect_uri = this.getCompleteUrl('/huawei') + (walineRedirect ? ('?' + qs.stringify({ redirect: walineRedirect })) : '');
    console.log('[Huawei] Token redirect_uri (used for /token):', redirect_uri);

    const form = {
      grant_type: 'authorization_code',
      code,
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      redirect_uri
    };

    console.log('[Huawei] Token request form (not showing code): [grant_type, client_id, client_secret, redirect_uri]');

    try {
      const tokenResponse = await request.post({
        url: ACCESS_TOKEN_URL,
        form,
        json: true,
        headers: { 'User-Agent': '@waline' }
      });

      console.log('[Huawei] Token response (keys):', Object.keys(tokenResponse));
      // delete stored mapping now we used it, to avoid reuse
      if (state && stateRedirectMap.has(state)) {
        stateRedirectMap.delete(state);
        console.log('[Huawei] Deleted state->redirect mapping for state:', state);
      }
      console.log('[Huawei] ===== TOKEN END =====\n');
      return tokenResponse;
    } catch (err) {
      console.error('[Huawei] Token request failed:', err && err.message);
      if (err && err.response) {
        console.error('[Huawei] Huawei error body:', err.response.body || err.response);
      }
      throw err;
    }
  }

  /**
   * Extract user information from id_token and normalize to Waline format.
   */
  async getUserInfoByToken(tokenInfo) {
    console.log('\n[Huawei] ===== USERINFO START =====');
    console.log('[Huawei] Raw tokenInfo keys:', tokenInfo ? Object.keys(tokenInfo) : tokenInfo);

    if (!tokenInfo || !tokenInfo.id_token) {
      console.error('[Huawei] ERROR: id_token missing from tokenInfo');
      throw new Error('Huawei id_token missing');
    }

    let decoded;
    try {
      decoded = jwtDecode(tokenInfo.id_token);
      console.log('[Huawei] Decoded id_token keys:', Object.keys(decoded || {}));
    } catch (err) {
      console.error('[Huawei] JWT decode failed:', err && err.message);
      throw err;
    }

    // Normalize fields: id (sub), name, email (may be absent), avatar/picture
    const normalized = {
      id: decoded.sub || decoded.openid || undefined,
      name: decoded.display_name || decoded.nickname || decoded.name || decoded.sub,
      email: decoded.email || `${decoded.sub}@huawei-uuid.com`,
      url: undefined,
      avatar: decoded.picture || decoded.picture_url || undefined,
      originalResponse: decoded
    };

    // Ensure id exists (Waline requires id). If missing, log fatal.
    console.log('[Huawei] Normalized user:', {
      id: normalized.id ? '[present]' : '[MISSING]',
      name: normalized.name,
      email: normalized.email ? '[present]' : '[missing]',
      avatar: normalized.avatar ? '[present]' : '[missing]'
    });
    console.log('[Huawei] ===== USERINFO END =====\n');

    return this.formatUserResponse(normalized, 'huawei');
  }
};