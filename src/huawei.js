const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');
const jwtDecode = require('jwt-decode');

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

const { HUAWEI_ID, HUAWEI_SECRET } = process.env;

module.exports = class extends Base {

  async redirect() {

    const { redirect, state } = this.ctx.params;

    const redirectUrl =
      this.getCompleteUrl('/huawei') +
      '?' +
      qs.stringify({ redirect, state });

    const url =
      OAUTH_URL +
      '?' +
      qs.stringify({
        client_id: HUAWEI_ID,
        redirect_uri: redirectUrl,
        response_type: 'code',
        scope: 'openid profile email',
        state
      });

    return this.ctx.redirect(url);
  }

  async getAccessToken(code) {

    const { redirect, state } = this.ctx.params;

    const redirectUrl =
      this.getCompleteUrl('/huawei') +
      '?' +
      qs.stringify({ redirect, state });

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

    return this.formatUserResponse({
      id: decoded.sub,
      name: decoded.name || decoded.email || decoded.sub,
      email: decoded.email,
      avatar: decoded.picture,
      originalResponse: decoded
    }, 'huawei');
  }

};