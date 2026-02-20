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
   * 核心修复：手动模拟 oauth.js 的 redirect 拼接逻辑
   * oauth.js 生成的地址格式固定为：${serverURL}/api/oauth?redirect=${originalRedirect}&type=huawei
   */
  _buildRedirectUri() {
    const { redirect, state, code } = this.ctx.params;
    const { serverURL } = this.ctx; // 获取当前 Waline 实例的基础 URL

    let finalRedirect = redirect;

    /**
     * 关键逻辑：
     * 如果 code 存在，说明现在是 Step 1 (oauth.js 的 fetch 阶段)。
     * 此时 ctx.params.redirect 丢失了，我们需要手动还原它。
     */
    if (code && !finalRedirect) {
      // 这里的逻辑必须与 oauth.js 第 32-34 行严格一致
      // 假设 Waline 默认跳转到 profile 页面
      const originalWalineRedirect = '/ui/profile'; 
      finalRedirect = `${serverURL}/api/oauth?redirect=${encodeURIComponent(originalWalineRedirect)}&type=huawei`;
      
      console.log(`[Huawei-Debug] Reconstructed missing redirect: ${finalRedirect}`);
    }

    const query = {};
    if (finalRedirect) query.redirect = finalRedirect;
    if (state) query.state = state;

    const queryString = qs.stringify(query);
    const finalUrl = this.getCompleteUrl('/huawei') + (queryString ? '?' + queryString : '');
    
    console.log(`[Huawei-Debug] Final RedirectURI: ${finalUrl}`);
    return finalUrl;
  }

  async getAccessToken(code) {
    console.log(`[Huawei-Debug] Step 1: Token Exchange Start`);
    const redirectUrl = this._buildRedirectUri();

    try {
      return await request.post({
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
    } catch (err) {
      console.error(`[Huawei-Debug] Token Exchange Error:`, err.error || err.message);
      throw err;
    }
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
    const redirectUrl = this._buildRedirectUri();

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: HUAWEI_ID,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: 'openid profile email'
    });

    console.log(`[Huawei-Debug] Step 0: Redirecting to Huawei`);
    return this.ctx.redirect(url);
  }
};