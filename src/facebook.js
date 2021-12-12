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
    const {state} = this.ctx.params;
    const params = {
      client_id: FACEBOOK_ID,
      client_secret: FACEBOOK_SECRET,
      code,
      redirect_uri: this.getCompleteUrl('/facebook') + '?' + qs.stringify({state})
    };

    return request.post({
      url: ACCESS_TOKEN_URL,
      headers: {'Accept': 'application/json'},
      form: params,
      json: true
    });
  }

  async getUserInfoByToken({access_token}) {
    const user = await request({
      url: USER_INFO_URL + '?' + qs.stringify({
        access_token,
        fields: ['id','name','email','picture','link'].join()
      }),
      method: 'GET',
      json: true,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      url: user.link,
      avatar: typeof user.picture === 'object' ? user.picture.data.url : user.picture,
    }
  }

  async redirect() {
    const {redirect, state} = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/facebook') + '?' + qs.stringify({
      state: qs.stringify({redirect, state})
    });

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

  async getUserInfo() {
    const {code, state: _state} = this.ctx.params;
    const {redirect, state} = qs.parse(_state);
    if(!code) {
      return this.redirect();
    }

    if(redirect && this.ctx.headers['user-agent'] !== '@waline') {
      return this.ctx.redirect(redirect + (redirect.includes('?') ? '&' : '?') + qs.stringify({ code, state }));
    }

    this.ctx.type = 'json';
    const accessTokenInfo = await this.getAccessToken(code);
    const userInfo = await this.getUserInfoByToken(accessTokenInfo);
    return this.ctx.body = userInfo;
  }
};