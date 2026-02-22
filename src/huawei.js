const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');
const { jwtDecode } = require('jwt-decode');

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

const { HUAWEI_ID, HUAWEI_SECRET } = process.env;

module.exports = class extends Base {

  static check() {
    console.log('[Huawei] check():', !!HUAWEI_ID, !!HUAWEI_SECRET);
    return HUAWEI_ID && HUAWEI_SECRET;
  }

  static info() {
    return {
      origin: new URL(OAUTH_URL).hostname
    };
  }

  async redirect() {
    const { state } = this.ctx.params;
    // redirect_uri MUST NOT include state
    const redirectUrl = this.getCompleteUrl('/huawei');
    const url =
      OAUTH_URL +
      '?' +
      qs.stringify({
        client_id: HUAWEI_ID,
        redirect_uri: redirectUrl,
        response_type: 'code',
        scope: 'openid profile email',
        state   // state only here
      });
    return this.ctx.redirect(url);
  }

  async getAccessToken(code) {
    const redirectUrl = this.getCompleteUrl('/huawei');
    return request.post({
      url: ACCESS_TOKEN_URL,
      form: {
        grant_type: 'authorization_code',
        code,
        client_id: HUAWEI_ID,
        client_secret: HUAWEI_SECRET,
        redirect_uri: redirectUrl
      },
      json: true
    });
  }

  async getUserInfoByToken({ id_token }) {

    const decoded = jwtDecode(id_token);

    console.log('[Huawei] decoded:', decoded);

    return this.formatUserResponse({
      id: decoded.sub,
      name: decoded.name || decoded.email || decoded.sub,
      email: decoded.email,
      avatar: decoded.picture,
      originalResponse: decoded
    }, 'huawei');
  }

};