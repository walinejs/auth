const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const ACCESS_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USER_INFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const {GOOGLE_ID, GOOGLE_SECRET} = process.env;
module.exports = class extends Base {
  constructor(ctx) {
    super(ctx);
  }

  async getAccessToken(code) {
    const {url} = this.ctx.params;
    const params = {
      client_id: GOOGLE_ID,
      client_secret: GOOGLE_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.getCompleteUrl('/google') + '?' + qs.stringify({redirect: url})
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
      url: USER_INFO_URL,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`
      },
      json: true
    });
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      url: '',
      avatar: user.picture,
    }
  }

  async redirect() {
    const {redirect, state} = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/google') + '?' + qs.stringify({redirect});

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: GOOGLE_ID,
      redirect_uri: redirectUrl,
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ].join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return this.ctx.redirect(url);
  }
};