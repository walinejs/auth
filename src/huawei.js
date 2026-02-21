const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';
// Using the standard userinfo endpoint for Huawei
const USER_INFO_URL = 'https://oauth-api.cloud.huawei.com/rest.php?nsp_svc=GWS.User.getCurrentUserInfo';

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
   * Exchange authorization code for access token
   */
  async getAccessToken(code) {
    const params = {
      grant_type: 'authorization_code',
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      code,
      redirect_uri: this.getCompleteUrl('/huawei')
    };

    return request.post({
      url: ACCESS_TOKEN_URL,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      form: params,
      json: true
    });
  }

  /**
   * Fetch user profile using the access token
   */
  async getUserInfoByToken({ access_token }) {
    // Note: Huawei often returns user info in the ID Token, 
    // but fetching from the API ensures the most current profile data.
    const userInfo = await request.post({
      url: USER_INFO_URL,
      form: {
        access_token: access_token
      },
      json: true
    });

    // Huawei's response structure usually contains 'unionId' or 'openId'
    // and 'displayName' / 'headPictureURL'
    return this.formatUserResponse({
      id: userInfo.unionId || userInfo.openId,
      name: userInfo.displayName || 'Huawei User',
      email: userInfo.email || undefined, // Email requires specific scopes
      url: '', 
      avatar: userInfo.headPictureURL,
      originalResponse: userInfo
    }, 'huawei');
  }

  /**
   * Redirect user to Huawei Login
   */
  async redirect() {
    const { redirect, state } = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/huawei') + '?' + qs.stringify({ redirect, state });

    const url = OAUTH_URL + '?' + qs.stringify({
      response_type: 'code',
      client_id: HUAWEI_ID,
      redirect_uri: redirectUrl,
      scope: 'openid profile email', // Basic scopes needed
      access_type: 'offline',
      state: state
    });

    return this.ctx.redirect(url);
  }
};