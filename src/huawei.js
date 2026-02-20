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
   * 核心修复逻辑：从当前请求或 state 中恢复原始的 redirect 参数
   */
  _getRecoveredParams() {
    const { redirect, state } = this.ctx.params;
    
    // 如果当前上下文有 redirect，直接使用
    if (redirect) {
      return { redirect, state };
    }

    // 如果没有 redirect 但有 state，尝试从 state 解码（针对 oauth.js 的 fetch 阶段）
    if (state) {
      try {
        // 解码 Waline 默认的 Base64 state
        const decoded = Buffer.from(state.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
        const payload = JSON.parse(decoded);
        
        // 如果 state 里面嵌套了原始 query (部分 OAuth 流程会这么做)
        if (payload.redirect) {
          return { redirect: payload.redirect, state };
        }
      } catch (e) {
        // 解码失败则维持现状
      }
    }

    return { redirect, state };
  }

  _buildRedirectUri() {
    const { redirect, state } = this._getRecoveredParams();
    const query = {};
    
    if (redirect) query.redirect = redirect;
    if (state) query.state = state;

    const queryString = qs.stringify(query);
    const finalUrl = this.getCompleteUrl('/huawei') + (queryString ? '?' + queryString : '');
    
    console.log(`[Huawei-Debug] Reconstructed RedirectURI: ${finalUrl}`);
    return finalUrl;
  }

  async getAccessToken(code) {
    console.log(`[Huawei-Debug] Step 1: Token Exchange Start`);
    const redirectUrl = this._buildRedirectUri();

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
      return response;
    } catch (err) {
      console.error(`[Huawei-Debug] Token Exchange Error Detail:`, err.error || err.message);
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
    const { redirect, state } = this.ctx.params;
    
    // 为了确保在 fetch 阶段能找回 redirect，我们确信 redirectUrl 构造逻辑正确
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