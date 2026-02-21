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
   * Main entry point for the callback
   */
  async indexAction() {
    const { code, state } = this.ctx.params;

    if (code) {
      // 1. Get Token and User Info from Huawei
      const tokenResponse = await this.getAccessToken(code);
      const userInfo = await this.getUserInfoByToken(tokenResponse);

      // 2. Identify if this is Waline Server calling via fetch()
      const isFetch = this.ctx.header['accept']?.includes('application/json') || 
                      this.ctx.header['user-agent']?.includes('@waline');

      if (isFetch) {
        return this.ctx.success(userInfo);
      }

      // 3. Browser logic: Redirect back to Waline
      let walineCallbackUrl = '';
      if (state) {
        try {
          const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
          walineCallbackUrl = decodedState.r; 
        } catch (e) {
          console.error('[Huawei OAuth] State parse error:', e);
        }
      }

      if (walineCallbackUrl) {
        // Construct the jump back to waline.lzc2002.top/api/oauth
        const finalJump = walineCallbackUrl + (walineCallbackUrl.includes('?') ? '&' : '?') + 
                          qs.stringify({ code, state });
        return this.ctx.redirect(finalJump);
      }

      return this.ctx.success(userInfo);
    }

    // Default to starting the redirect flow
    return this.redirect();
  }

  async getAccessToken(code) {
    // Note: We use the clean URL here because Huawei requires the redirect_uri 
    // to match what was sent in the initial Step 0 exactly.
    const redirectUrl = this.getCompleteUrl('/huawei');

    return request.post({
      url: ACCESS_TOKEN_URL,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      form: {
        grant_type: 'authorization_code',
        client_id: HUAWEI_ID,
        client_secret: HUAWEI_SECRET,
        code,
        redirect_uri: redirectUrl
      },
      json: true
    });
  }

  async getUserInfoByToken(tokenResponse) {
    const { id_token } = tokenResponse;
    if (!id_token) throw new Error('Huawei OAuth failed: no id_token');

    const payload = JSON.parse(
      Buffer.from(id_token.split('.')[1], 'base64').toString()
    );

    return this.formatUserResponse({
      id: payload.sub,
      name: payload.nickname || payload.display_name || payload.sub,
      email: payload.email || `${payload.sub}@huawei-uuid.com`,
      avatar: payload.picture,
      url: undefined,
      originalResponse: payload
    }, 'huawei');
  }

  async redirect() {
    const { redirect, state } = this.ctx.params;

    // We store the Waline callback URL (redirect) and Waline's state (state) 
    // inside a new base64 string so we can recover them later.
    const oauthState = Buffer.from(JSON.stringify({ r: redirect, s: state })).toString('base64');
    
    const redirectUrl = this.getCompleteUrl('/huawei');

    const url = OAUTH_URL + '?' + qs.stringify({
        client_id: HUAWEI_ID,
        redirect_uri: redirectUrl,
        response_type: 'code',
        scope: 'openid profile email',
        state: oauthState
      });

    return this.ctx.redirect(url);
  }
};