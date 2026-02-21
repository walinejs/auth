const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';
const USER_INFO_URL = 'https://api.vmall.com/rest.php'; // 警告：此为示例，请替换为华为官方文档中的正确用户信息API

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

  async getAccessToken(code) {
    const params = {
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.getCompleteUrl('/huawei') // 【修复点1】根据OAuth 2.0规范，获取token时通常也需要提供redirect_uri
    };

    console.debug('[Huawei OAuth Debug] getAccessToken - Request Params:', params);
    console.debug('[Huawei OAuth Debug] getAccessToken - Request URL:', ACCESS_TOKEN_URL);

    try {
      const tokenResponse = await request.post({
        url: ACCESS_TOKEN_URL,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: params,
        json: true
      });
      console.debug('[Huawei OAuth Debug] getAccessToken - Success Response:', tokenResponse);
      return tokenResponse;
    } catch (error) {
      console.error('[Huawei OAuth Debug] getAccessToken - Error:', error.message, error.response ? error.response.body : 'No response body');
      throw error;
    }
  }

  async getUserInfoByToken({ access_token }) {
    console.debug('[Huawei OAuth Debug] getUserInfoByToken - Access Token:', access_token ? 'Present (hidden for security)' : 'Missing');
    console.debug('[Huawei OAuth Debug] getUserInfoByToken - Requesting URL:', USER_INFO_URL);

    // **重要：以下部分仅为示例模板。您必须根据华为官方API文档替换USER_INFO_URL并调整字段映射。**
    try {
      // 假设华为用户信息API需要以特定格式传递access_token（例如作为Bearer Token或查询参数）
      const userInfo = await request.get({
        url: USER_INFO_URL,
        headers: {
          'User-Agent': '@waline',
          'Authorization': `Bearer ${access_token}` // 常见方式，请根据华为文档确认
        },
        json: true
      });
      console.debug('[Huawei OAuth Debug] getUserInfoByToken - Raw API Response:', userInfo);

      // 映射华为API返回的字段到Waline期望的格式。
      // 您需要查阅华为文档，确定以下字段在响应中的实际键名。
      return this.formatUserResponse({
        id: userInfo.openid || userInfo.sub || userInfo.user_id || userInfo.unionId, // 使用实际的唯一标识字段
        name: userInfo.displayName || userInfo.nickname || userInfo.name || 'Huawei User',
        email: userInfo.email || userInfo.emailAddress || undefined,
        url: userInfo.profilePictureUrl || userInfo.avatar || userInfo.picture || undefined, // 个人主页链接，非头像
        avatar: userInfo.headPictureURL || userInfo.profilePictureUrl || userInfo.avatarUrl || undefined, // 头像链接
        originalResponse: userInfo
      }, 'huawei');
    } catch (error) {
      console.error('[Huawei OAuth Debug] getUserInfoByToken - Error:', error.message, error.response ? error.response.body : 'No response body');
      throw error;
    }
  }

  async redirect() {
    const { redirect, state } = this.ctx.params;
    
    // 【修复点2 & 调试】构建准确的回调地址 (redirect_uri)
    // 注意：这里的回调地址不应包含来自上游的 `redirect` 和 `state` 查询参数。
    // 根据 `oauth.js` 的逻辑，`oauth.js` 会将自己的 `redirect` 和 `type` 参数编码到它发给我们的URL中。
    // 我们只需要将纯净的、与华为后台配置一致的端点地址作为 `redirect_uri` 传给华为。
    const redirectUri = this.getCompleteUrl('/huawei'); // 例如：https://your-server.com/api/oauth/huawei
    console.debug('[Huawei OAuth Debug] redirect - Calculated redirect_uri:', redirectUri);
    console.debug('[Huawei OAuth Debug] redirect - Received params (for oauth.js):', { redirect, state });

    // 【修复点3】确保所有必要参数都被正确编码并传递
    const authParams = {
      client_id: HUAWEI_ID,
      response_type: 'code',
      scope: 'openid profile', // 请根据华为文档确认所需scope
      redirect_uri: redirectUri, // 使用纯净的回调地址
      state: state || '', // 传递state参数（由oauth.js生成并传递给我们）
      // access_type: 'offline' // 非标准参数，请根据华为文档决定是否添加
    };

    // 移除可能为空的参数（如空state），但通常保留亦可
    Object.keys(authParams).forEach(key => {
      if (authParams[key] === null || authParams[key] === undefined || authParams[key] === '') {
        delete authParams[key];
      }
    });

    const finalAuthUrl = OAUTH_URL + '?' + qs.stringify(authParams);
    console.debug('[Huawei OAuth Debug] redirect - Final Authorization URL to redirect user:', finalAuthUrl);

    return this.ctx.redirect(finalAuthUrl);
  }
};