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
    // coerce state to string
    state = Array.isArray(state) ? state[0] : (state === undefined ? '' : String(state));

    if (redirect) {
      // store mapping so server->server token exchange can reuse identical redirect_uri
      stateRedirectMap.set(state, { redirect: String(redirect), ts: Date.now() });
    } else {
      console.log('[Huawei] WARNING: authorize called without redirect param');
    }

    // **Important**: redirect_uri we give to Huawei must include the same `redirect` param
    // so that when Huawei redirects back to our /huawei endpoint the browser will get forwarded to Waline.
    const redirect_uri = this.getCompleteUrl('/huawei') + (redirect ? ('?' + qs.stringify({ redirect })) : '');

    const authorizeUrl = OAUTH_URL + '?' + qs.stringify({
      client_id: HUAWEI_ID,
      redirect_uri,
      response_type: 'code',
      scope: 'openid profile email',
      state
    });
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
    state = Array.isArray(state) ? state[0] : (state === undefined ? '' : String(state));
    redirect = Array.isArray(redirect) ? redirect[0] : (redirect === undefined ? undefined : String(redirect));

    // find redirect: 1) use redirect param if present; 2) else lookup saved mapping by state
    let walineRedirect = redirect;
    if (!walineRedirect && state) {
      const rec = stateRedirectMap.get(state);
      if (rec && rec.redirect) {
        walineRedirect = rec.redirect;
      } else {
        console.warn('[Huawei] WARNING: no stored redirect for state:', state);
      }
    }

    // Build redirect_uri for token exchange — MUST be exactly the same as authorize.
    const redirect_uri = this.getCompleteUrl('/huawei') + (walineRedirect ? ('?' + qs.stringify({ redirect: walineRedirect })) : '');

    const form = {
      grant_type: 'authorization_code',
      code,
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      redirect_uri
    };

    try {
      const tokenResponse = await request.post({
        url: ACCESS_TOKEN_URL,
        form,
        json: true,
        headers: { 'User-Agent': '@waline' }
      });

      // delete stored mapping now we used it, to avoid reuse
      if (state && stateRedirectMap.has(state)) {
        stateRedirectMap.delete(state);
      }
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
    if (!tokenInfo || !tokenInfo.id_token) {
      console.error('[Huawei] ERROR: id_token missing from tokenInfo');
      throw new Error('Huawei id_token missing');
    }

    let decoded;
    try {
      decoded = jwtDecode(tokenInfo.id_token);
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

    return this.formatUserResponse(normalized, 'huawei');
  }
};