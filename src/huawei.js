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
      
      // 1. 获取 Token 和 用户信息
      const tokenResponse = await this.getAccessToken(code);
      const userInfo = await this.getUserInfoByToken(tokenResponse);

      // 2. 从 state 中还原 Waline 的回调地址 (r)
      let walineCallbackUrl = '';
      if (state) {
        try {
          const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
          walineCallbackUrl = decodedState.r; // 对应之前存入的 redirect
        } catch (e) {
          console.error('[Huawei OAuth] Failed to parse state:', e);
        }
      }

      // 3. 如果有 walineCallbackUrl，则带上 code 和 state 跳回 Waline
      if (walineCallbackUrl) {
        const finalJump = walineCallbackUrl + (walineCallbackUrl.includes('?') ? '&' : '?') + 
                          qs.stringify({ code, state });
        
        console.log(`[Huawei OAuth] Final jump back to Waline: ${finalJump}`);
        return this.ctx.redirect(finalJump);
      }

      // 如果没有跳转地址，才输出 JSON (兜底)
      return this.ctx.success(userInfo);
    }

    return this.redirect();
  }

  /**
   * Step 1: code -> token
   */
  async getAccessToken(code) {
    const redirectUrl = this.getCompleteUrl('/huawei');
    
    console.log(`[Huawei OAuth] Exchanging code: ${code.substring(0, 10)}...`);

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

    console.log('[Huawei OAuth] Token Response:', response);
    return response;
  }

  /**
   * Step 2: parse id_token
   */
  async getUserInfoByToken(tokenResponse) {
    const { id_token } = tokenResponse;

    if (!id_token) {
      console.error('[Huawei OAuth] Error: No id_token in response');
      throw new Error('Huawei OAuth failed: no id_token');
    }

    const payload = JSON.parse(
      Buffer.from(id_token.split('.')[1], 'base64').toString()
    );

    console.log('[Huawei OAuth] User Payload:', payload);

    return this.formatUserResponse({
      id: payload.sub,
      name: payload.nickname || payload.display_name || payload.name || payload.sub,
      email: payload.email || `${payload.sub}@huawei-uuid.com`,
      avatar: payload.picture,
      url: undefined,
      originalResponse: payload
    }, 'huawei');
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