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
   * Step 1: Waline → Huawei authorize
   */
  async redirect() {

    const { redirect, state } = this.ctx.params;

    console.log('\n[Huawei] ===== AUTHORIZE START =====');
    console.log('[Huawei] Waline redirect:', redirect);
    console.log('[Huawei] Waline state:', state);
    console.log('[Huawei] State type:', typeof state);

    // redirect_uri must be THIS endpoint only
    const redirect_uri = this.getCompleteUrl('/huawei');

    console.log('[Huawei] Huawei redirect_uri:', redirect_uri);

    const authorizeUrl =
      OAUTH_URL +
      '?' +
      qs.stringify({
        client_id: HUAWEI_ID,
        redirect_uri,
        response_type: 'code',
        scope: 'openid profile email',
        state: String(state)
      });

    console.log('[Huawei] Final authorize URL:', authorizeUrl);
    console.log('[Huawei] ===== AUTHORIZE END =====\n');

    return this.ctx.redirect(authorizeUrl);
  }

  /**
   * Step 2: Huawei → exchange code for token
   */
  async getAccessToken(code) {

    const { state } = this.ctx.params;

    console.log('\n[Huawei] ===== TOKEN START =====');
    console.log('[Huawei] Received code:', code);
    console.log('[Huawei] Received state:', state);

    // MUST match authorize redirect_uri exactly
    const redirect_uri = this.getCompleteUrl('/huawei');

    console.log('[Huawei] Token redirect_uri:', redirect_uri);

    const formData = {
      grant_type: 'authorization_code',
      code,
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      redirect_uri
    };

    console.log('[Huawei] Token request form:', formData);

    let tokenResponse;

    try {

      tokenResponse = await request.post({
        url: ACCESS_TOKEN_URL,
        form: formData,
        json: true
      });

    } catch (err) {

      console.error('[Huawei] Token request failed:', err.message);

      if (err.response) {
        console.error('[Huawei] Huawei error response:', err.response.body);
      }

      throw err;
    }

    console.log('[Huawei] Token response:', tokenResponse);
    console.log('[Huawei] ===== TOKEN END =====\n');

    return tokenResponse;
  }

  /**
   * Step 3: Extract user info from id_token
   */
  async getUserInfoByToken(tokenInfo) {

    console.log('\n[Huawei] ===== USERINFO START =====');
    console.log('[Huawei] Raw tokenInfo:', tokenInfo);

    const { id_token } = tokenInfo;

    if (!id_token) {

      console.error('[Huawei] ERROR: id_token missing');

      throw new Error('Huawei id_token missing');
    }

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