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
    // 【重要】这里的 redirect_uri 必须与 redirect() 方法中的完全一致，且在华为后台注册过
    const redirectUrl = this.getCompleteUrl('/huawei');
    
    console.log(`[Huawei OAuth] Attempting to exchange code for token. Code: ${code.substring(0, 10)}...`);

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

      if (response.error) {
        console.error('[Huawei OAuth] Token exchange error response:', response);
      }
      return response;
    } catch (e) {
      console.error('[Huawei OAuth] Network error during token exchange:', e.message);
      throw e;
    }
  }

  /**
   * Step 2: parse id_token
   */
  async getUserInfoByToken(tokenResponse) {
    const { id_token, access_token } = tokenResponse;

    if (!id_token) {
      console.error('[Huawei OAuth] No id_token found in response. Response keys:', Object.keys(tokenResponse));
      throw new Error('Huawei OAuth failed: no id_token');
    }

    try {
      // id_token 是 JWT 格式: header.payload.signature
      const segments = id_token.split('.');
      if (segments.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(
        Buffer.from(segments[1], 'base64').toString()
      );

      console.log('[Huawei OAuth] Decoded user payload:', payload);

      // 华为 payload 字段映射
      return this.formatUserResponse({
        id: payload.sub, // 唯一标识
        name: payload.nickname || payload.display_name || payload.name || payload.sub,
        email: payload.email || `${payload.sub}@huawei-uuid.com`,
        avatar: payload.picture,
        url: undefined,
        originalResponse: payload
      }, 'huawei');

    } catch (e) {
      console.error('[Huawei OAuth] Failed to parse id_token:', e.message);
      throw e;
    }
  }

  /**
   * Step 0: redirect user to Huawei login
   */
  async redirect() {
    const { redirect, state } = this.ctx.params;

    // 保持 redirect_uri 简洁，避免华为校验失败
    const redirectUrl = this.getCompleteUrl('/huawei');

    // 将原本在 URL 上的参数封装进 OAuth 的 state 字段中
    // 这样在回调时，这些信息会原样返回给 callback 接口
    const oauthState = qs.stringify({ redirect, state });

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: HUAWEI_ID,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: 'openid profile email',
      state: oauthState 
    });

    console.log(`[Huawei OAuth] Redirecting to: ${url}`);
    return this.ctx.redirect(url);
  }
};