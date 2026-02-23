const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');
const { jwtDecode } = require('jwt-decode'); // v4+ import

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

const { HUAWEI_ID, HUAWEI_SECRET } = process.env;

module.exports = class extends Base {
  static check() {
    return HUAWEI_ID && HUAWEI_SECRET;
  }

  static info() {
    return { origin: new URL(OAUTH_URL).hostname };
  }

  async redirect() {
    let { redirect, state } = this.ctx.params;
    
    state = Array.isArray(state) ? state[0] : (state === undefined ? '' : String(state));

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

  async getAccessToken(code) {
    // state might be present in params (server-to-server call includes it)
    let { state, redirect } = this.ctx.params;
    state = Array.isArray(state) ? state[0] : (state === undefined ? '' : String(state));
    redirect = Array.isArray(redirect) ? redirect[0] : (redirect === undefined ? undefined : String(redirect));


    // Build redirect_uri for token exchange — MUST be exactly the same as authorize.
    const redirect_uri = this.getCompleteUrl('/huawei') + (redirect ? ('?' + qs.stringify({ redirect })) : '');
    
    const form = {
      grant_type: 'authorization_code',
      code,
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      redirect_uri
    };

    try {
      return request.post({
        url: ACCESS_TOKEN_URL,
        form,
        json: true,
        headers: { 'User-Agent': '@waline' }
      });
    } catch (err) {
      console.error('[Huawei] Token request failed:', err && err.message);
      if (err && err.response) {
        console.error('[Huawei] Huawei error body:', err.response.body || err.response);
      }
      throw err;
    }
  }

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

    return {
      id: decoded.sub || decoded.openid || undefined,
      name: decoded.display_name || decoded.nickname || decoded.name || decoded.sub,
      email: decoded.email,
      url: undefined,
      avatar: decoded.picture || decoded.picture_url || undefined
    };
  }
};