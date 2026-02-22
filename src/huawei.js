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

    const { redirect, state } = this.ctx.params;

    console.log('[Huawei] Waline redirect:', redirect);
    console.log('[Huawei] state:', state);

    const redirect_uri =
      this.getCompleteUrl('/huawei') +
      '?' +
      qs.stringify({ redirect });

    console.log('[Huawei] redirect_uri:', redirect_uri);

    const url =
      OAUTH_URL +
      '?' +
      qs.stringify({
        client_id: HUAWEI_ID,
        redirect_uri,
        response_type: 'code',
        scope: 'openid profile email',
        state
      });

    console.log('[Huawei] authorize URL:', url);

    return this.ctx.redirect(url);
  }

  async getAccessToken(code) {

    const { redirect } = this.ctx.params;

    const redirect_uri =
      this.getCompleteUrl('/huawei') +
      '?' +
      qs.stringify({ redirect });

    console.log('[Huawei] token redirect_uri:', redirect_uri);

    const token = await request.post({
      url: ACCESS_TOKEN_URL,
      form: {
        grant_type: 'authorization_code',
        code,
        client_id: HUAWEI_ID,
        client_secret: HUAWEI_SECRET,
        redirect_uri
      },
      json: true
    });

    console.log('[Huawei] token response:', token);

    return token;
  }

  async getUserInfoByToken(tokenInfo) {

    const decoded = jwtDecode(tokenInfo.id_token);

    console.log('[Huawei] decoded user:', decoded);

    return this.formatUserResponse({
      id: decoded.sub,
      name: decoded.display_name || decoded.nickname || decoded.sub,
      email: decoded.email,
      avatar: decoded.picture,
      originalResponse: decoded
    }, 'huawei');
  }

};