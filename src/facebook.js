const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://www.facebook.com/v4.0/dialog/oauth';
const ACCESS_TOKEN_URL = 'https://graph.facebook.com/v4.0/oauth/access_token';
const USER_INFO_URL = 'https://graph.facebook.com/me';

const {FACEBOOK_ID, FACEBOOK_SECRET} = process.env;
module.exports = class extends Base {
  constructor(ctx) {
    super(ctx);
  }

  async getAccessToken(code) {
    const {url, state} = this.ctx.params;
    const params = {
      client_id: FACEBOOK_ID,
      client_secret: FACEBOOK_SECRET,
      code,
      redirect_uri: this.getCompleteUrl('/facebook') + '?' + qs.stringify({redirect: url, state})
    };
    console.log('after:', params.redirect_uri);

    return request.post({
      url: ACCESS_TOKEN_URL,
      headers: {'Accept': 'application/json'},
      form: params,
      json: true
    });
  }

  async getUserInfoByToken({access_token}) {
    return request.get(USER_INFO_URL + '?' + qs.stringify({
      access_token,
      fields: ['id', 'name', 'email', 'short_name'].join()
    }));
  }

  async redirect() {
    const {redirect, state} = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/facebook') + '?' + qs.stringify({redirect, state});
    console.log('before:', redirectUrl);

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: FACEBOOK_ID,
      redirect_uri: redirectUrl,
      scope: ['email'].join(),
      response_type: 'code',
      auth_type: 'rerequest',
      display: 'popup',
    });
    return this.ctx.redirect(url);
  }
};