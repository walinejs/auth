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
  async indexAction() {
    const { code } = this.ctx.params;

    // 如果 URL 里已经有 code 了，说明是从华为跳回来的，不应该再跳转
    if (code) {
        console.log('[Huawei OAuth] Callback detected with code, proceeding to get token.');
        // 这里由 Base 类或你的框架逻辑调用 getAccessToken 和 getUserInfoByToken
        // 如果你的框架 indexAction 会自动处理流程，请确保它不会走到下面的 redirect
        return super.indexAction ? await super.indexAction() : null; 
    }

    // 如果没有 code，才去执行重定向到华为
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