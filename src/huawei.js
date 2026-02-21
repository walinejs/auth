const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

const { HUAWEI_ID, HUAWEI_SECRET } = process.env;

module.exports = class extends Base {

  static check() {
    return HUAWEI_ID && HUAWEI_SECRET;
  }

  static info() {
    return {
      origin: new URL(OAUTH_URL).hostname
    };
  }

  /**
   * Step 1: code -> token
   */
  async getAccessToken(code) {
    // DEBUG: Log the incoming code and current params
    console.log('[Huawei Debug] Entering getAccessToken');
    console.log('[Huawei Debug] Code:', code);
    console.log('[Huawei Debug] Params:', this.ctx.params);

    // FIX: The redirect_uri must match EXACTLY what was sent in Step 0.
    // We should NOT append query params here because they are already inside the 'state' 
    // being handled by oauth.js.
    const redirectUrl = this.getCompleteUrl('/huawei');
    console.log('[Huawei Debug] Using Redirect URI:', redirectUrl);

    try {
      const response = await request.post({
        url: ACCESS_TOKEN_URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
          grant_type: 'authorization_code',
          client_id: HUAWEI_ID,
          client_secret: HUAWEI_SECRET,
          code,
          redirect_uri: redirectUrl
        },
        json: true
      });
      
      console.log('[Huawei Debug] Access Token Response:', JSON.stringify(response));
      return response;
    } catch (err) {
      console.error('[Huawei Debug] Request Error:', err.message);
      if (err.response && err.response.body) {
        console.error('[Huawei Debug] Error Body:', JSON.stringify(err.response.body));
      }
      throw err;
    }
  }

  /**
   * Step 2: parse id_token (OFFICIAL METHOD)
   */
  async getUserInfoByToken(tokenResponse) {
    console.log('[Huawei Debug] Parsing user info from tokenResponse');
    const { id_token } = tokenResponse;

    if (!id_token) {
      console.error('[Huawei Debug] No id_token found in response');
      throw new Error('Huawei OAuth failed: no id_token');
    }

    const payload = JSON.parse(
      Buffer.from(id_token.split('.')[1], 'base64').toString()
    );

    console.log('[Huawei Debug] Decoded Payload:', JSON.stringify(payload));

    const result = this.formatUserResponse({
      id: payload.sub,
      name: payload.nickname || payload.display_name || payload.name || payload.sub,
      email: payload.email || `${payload.sub}@huawei-uuid.com`,
      avatar: payload.picture,
      url: undefined,
      originalResponse: payload
    }, 'huawei');

    console.log('[Huawei Debug] Formatted User Result:', JSON.stringify(result));
    return result;
  }

  /**
   * Step 0: redirect user to Huawei login
   */
  async redirect() {
    // Note: 'state' passed from oauth.js contains the base64-encoded Waline context
    const { state } = this.ctx.params;
    
    // We use a clean redirect_uri.
    const redirectUrl = this.getCompleteUrl('/huawei');

    console.log('[Huawei Debug] Redirecting to Huawei login');
    console.log('[Huawei Debug] Callback URL (redirect_uri):', redirectUrl);
    console.log('[Huawei Debug] Outgoing State:', state);

    const query = {
      client_id: HUAWEI_ID,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: 'openid profile email',
      state: state // Forward the packed state
    };

    const url = `${OAUTH_URL}?${qs.stringify(query)}`;
    
    return this.ctx.redirect(url);
  }
};