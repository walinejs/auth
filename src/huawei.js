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

    const { redirect, state } = this.ctx.params;
    const query = { redirect, state };
    Object.keys(query).forEach(key => query[key] === undefined && delete query[key]);
    const redirectUrl = this.getCompleteUrl('/huawei') + (Object.keys(query).length ? '?' + qs.stringify(query) : '');

    return request.post({
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
  }

  /**
   * Step 2: parse id_token (OFFICIAL METHOD)
   */
  async getUserInfoByToken(tokenResponse) {

    const { id_token } = tokenResponse;

    if (!id_token) {
      throw new Error('Huawei OAuth failed: no id_token');
    }

    /**
     * id_token is JWT:
     * header.payload.signature
     */

    const payload = JSON.parse(
      Buffer.from(id_token.split('.')[1], 'base64').toString()
    );

    /**
     * payload example (Huawei official):
     * {
     *   sub: "100xxxx",
     *   email: "xxx@email.com",
     *   picture: "https://...",
     *   name: "xxx"
     * }
     */

    return this.formatUserResponse({
      id: payload.sub,
      name: payload.nickname || payload.display_name || payload.sub,
      email: payload.email || `${payload.sub}@huawei-uuid.com`,
      avatar: payload.picture,
      url: undefined,
      originalResponse: payload
    }, 'huawei');
  }

  /**
   * Step 0: redirect user to Huawei login
   */
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
        scope: 'openid profile email'
      });

    return this.ctx.redirect(url);
  }

};