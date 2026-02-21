const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');
const { jwtDecode } = require('jwt-decode');

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

const { HUAWEI_ID, HUAWEI_SECRET } = process.env;

module.exports = class extends Base {

  static check() {
    console.log('[Huawei] check():', !!HUAWEI_ID, !!HUAWEI_SECRET);
    return HUAWEI_ID && HUAWEI_SECRET;
  }

  static info() {
    return {
      origin: new URL(OAUTH_URL).hostname
    };
  }

  /**
   * Step 1: Redirect user to Huawei login
   */
  async redirect() {

    let { redirect, state } = this.ctx.params;

    console.log('\n[Huawei] ===== REDIRECT START =====');
    console.log('[Huawei] Raw redirect param:', redirect);
    console.log('[Huawei] Raw state param:', state);
    console.log('[Huawei] State type:', typeof state);

    // FORCE state string
    state = String(state);

    const redirectUrl =
      this.getCompleteUrl('/huawei') +
      '?' +
      qs.stringify({ redirect, state });

    console.log('[Huawei] Computed redirect_uri:', redirectUrl);

    const url =
      OAUTH_URL +
      '?' +
      qs.stringify({
        client_id: HUAWEI_ID,
        redirect_uri: redirectUrl,
        response_type: 'code',
        scope: 'openid profile email',
        state
      });

    console.log('[Huawei] Final authorize URL:', url);
    console.log('[Huawei] ===== REDIRECT END =====\n');

    return this.ctx.redirect(url);
  }

  /**
   * Step 2: Exchange code for token
   */
  async getAccessToken(code) {

    let { redirect, state } = this.ctx.params;

    console.log('\n[Huawei] ===== TOKEN START =====');
    console.log('[Huawei] Received code:', code);
    console.log('[Huawei] Received redirect param:', redirect);
    console.log('[Huawei] Received state param:', state);
    console.log('[Huawei] State type:', typeof state);

    state = String(state);

    const redirectUrl =
      this.getCompleteUrl('/huawei') +
      '?' +
      qs.stringify({ redirect, state });

    console.log('[Huawei] Token redirect_uri:', redirectUrl);

    const formData = {
      grant_type: 'authorization_code',
      code,
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      redirect_uri: redirectUrl
    };

    console.log('[Huawei] Token request body:', formData);

    const tokenResponse = await request.post({
      url: ACCESS_TOKEN_URL,
      form: formData,
      json: true
    });

    console.log('[Huawei] Token response:', tokenResponse);
    console.log('[Huawei] ===== TOKEN END =====\n');

    return tokenResponse;
  }

  /**
   * Step 3: Decode id_token and extract user info
   */
  async getUserInfoByToken(tokenInfo) {

    console.log('\n[Huawei] ===== USERINFO START =====');
    console.log('[Huawei] Raw tokenInfo:', tokenInfo);

    const { id_token, access_token } = tokenInfo;

    if (!id_token) {
      console.error('[Huawei] ERROR: id_token missing');
      throw new Error('Huawei id_token missing');
    }

    console.log('[Huawei] id_token:', id_token);

    let decoded;

    try {
      decoded = jwtDecode(id_token);
    } catch (err) {
      console.error('[Huawei] JWT decode failed:', err);
      throw err;
    }

    console.log('[Huawei] Decoded id_token:', decoded);

    const user = {
      id: decoded.sub,
      name: decoded.name || decoded.email || decoded.sub,
      email: decoded.email || undefined,
      url: undefined,
      avatar: decoded.picture || undefined,
      originalResponse: decoded
    };

    console.log('[Huawei] Normalized user:', user);
    console.log('[Huawei] ===== USERINFO END =====\n');

    return this.formatUserResponse(user, 'huawei');
  }

};