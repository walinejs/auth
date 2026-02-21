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
   * 华为回调入口逻辑修正
   */
  // huawei.js 内部修改
  async indexAction() {
    const { code, state } = this.ctx.params;

    if (code) {
      console.log('[Huawei OAuth] Callback detected, fetching user info...');
      
      // 1. Get Token and User Info
      const tokenResponse = await this.getAccessToken(code);
      const userInfo = await this.getUserInfoByToken(tokenResponse);

      // --- NEW LOGIC START ---
      // Check if the request wants JSON (Server-to-Server) 
      // or if it's a browser request (based on headers or the absence of the redirect URL)
      const isFetch = this.ctx.header['accept']?.includes('application/json') || 
                      this.ctx.header['user-agent']?.includes('@waline');

      if (isFetch) {
        console.log('[Huawei OAuth] Server-to-server request detected. Returning JSON.');
        return this.ctx.success(userInfo);
      }
      // --- NEW LOGIC END ---

      // 2. Browser logic: Restore the Waline callback address (r) from state
      let walineCallbackUrl = '';
      if (state) {
        try {
          const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
          walineCallbackUrl = decodedState.r; 
        } catch (e) {
          console.error('[Huawei OAuth] Failed to parse state:', e);
        }
      }

      // 3. Jump back to Waline so the Waline Server can execute its CALLBACK PHASE
      if (walineCallbackUrl) {
        const finalJump = walineCallbackUrl + (walineCallbackUrl.includes('?') ? '&' : '?') + 
                          qs.stringify({ code, state });
        
        console.log(`[Huawei OAuth] Redirecting browser back to Waline: ${finalJump}`);
        return this.ctx.redirect(finalJump);
      }

      return this.ctx.success(userInfo);
    }

    return this.redirect();
  }

  /**
   * Step 1: code -> token
   */
  async getAccessToken(code) {
    const { redirect, state } = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/huawei');

    console.log('[Huawei Debug] Requesting Access Token with RedirectURI:', redirectUrl);

    try {
      const response = await request.post({
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
      console.log('[Huawei Debug] Token Response:', response); // 检查是否包含 id_token
      return response;
    } catch (err) {
      console.error('[Huawei Debug] Access Token Request Failed:', err.message);
      throw err;
    }
  }

  /**
   * Step 2: parse id_token
   */
  async getUserInfoByToken(tokenResponse) {
    const { id_token } = tokenResponse;

    if (!id_token) {
      console.error('[Huawei Debug] No id_token found in response!');
      throw new Error('Huawei OAuth failed: no id_token');
    }

    try {
      const payload = JSON.parse(
        Buffer.from(id_token.split('.')[1], 'base64').toString()
      );
      console.log('[Huawei Debug] Decoded ID Token Payload:', payload);

      // 格式化输出前打印，确认 sub (id) 是否存在
      const formatted = this.formatUserResponse({
        id: payload.sub,
        name: payload.nickname || payload.display_name || payload.sub,
        email: payload.email || `${payload.sub}@huawei-uuid.com`,
        avatar: payload.picture,
        url: undefined,
        originalResponse: payload
      }, 'huawei');
      
      console.log('[Huawei Debug] Final Formatted User:', formatted);
      return formatted;
    } catch (e) {
      console.error('[Huawei Debug] JWT Decode Error:', e);
      throw e;
    }
  }

  /**
   * Step 0: 重定向到华为
   */
  async redirect() {
    const { redirect, state } = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/huawei');

    // 关键修正：对 state 进行 Base64 编码，防止参数中的 & 和 = 干扰华为的回调解析
    const stateObj = { r: redirect, s: state };
    const encodedState = Buffer.from(JSON.stringify(stateObj)).toString('base64');

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: HUAWEI_ID,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: 'openid profile email',
      state: encodedState
    });

    console.log(`[Huawei OAuth] Initial Redirect to Huawei: ${url}`);
    return this.ctx.redirect(url);
  }
};