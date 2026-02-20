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
   * 辅助方法：构造与授权阶段完全一致的 Redirect URL
   */
  _buildRedirectUri() {
    const { redirect, state } = this.ctx.params;
    const query = {};
    
    // 只有当参数存在时才加入 query，确保生成的 URL 字节级匹配
    if (redirect) query.redirect = redirect;
    if (state) query.state = state;

    const queryString = qs.stringify(query);
    const finalUrl = this.getCompleteUrl('/huawei') + (queryString ? '?' + queryString : '');
    
    console.log(`[Huawei-Debug] Generated RedirectURI: ${finalUrl}`);
    return finalUrl;
  }

  /**
   * Step 1: code -> token
   */
  async getAccessToken(code) {
    console.log(`[Huawei-Debug] Step 1: Exchanging code for token. Code: ${code.substring(0, 10)}...`);
    
    const redirectUrl = this._buildRedirectUri();

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

      console.log(`[Huawei-Debug] Token Response Success: ${!!response.id_token}`);
      return response;
    } catch (err) {
      console.error(`[Huawei-Debug] Token Exchange Error:`, err.error || err.message);
      throw err;
    }
  }

  /**
   * Step 2: parse id_token
   */
  async getUserInfoByToken(tokenResponse) {
    const { id_token } = tokenResponse;

    if (!id_token) {
      console.error(`[Huawei-Debug] No id_token in response:`, tokenResponse);
      throw new Error('Huawei OAuth failed: no id_token');
    }

    try {
      // id_token 是 JWT 格式: header.payload.signature
      const payload = JSON.parse(
        Buffer.from(id_token.split('.')[1], 'base64').toString()
      );

      console.log(`[Huawei-Debug] Decoded User Payload:`, { 
        sub: payload.sub, 
        name: payload.nickname || payload.display_name 
      });

      return this.formatUserResponse({
        id: payload.sub,
        name: payload.nickname || payload.display_name || payload.sub,
        email: payload.email || `${payload.sub}@huawei-uuid.com`,
        avatar: payload.picture,
        url: undefined,
        originalResponse: payload
      }, 'huawei');
    } catch (err) {
      console.error(`[Huawei-Debug] Payload Parse Error:`, err.message);
      throw err;
    }
  }

  /**
   * Step 0: redirect user to Huawei login
   */
  async redirect() {
    const redirectUrl = this._buildRedirectUri();

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: HUAWEI_ID,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: 'openid profile email'
    });

    console.log(`[Huawei-Debug] Step 0: Redirecting to Huawei: ${url}`);
    return this.ctx.redirect(url);
  }

};