const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://github.com/login/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_INFO_URL = 'https://api.github.com/user';
const USER_EMAILS = 'https://api.github.com/user/emails';

const {GITHUB_ID, GITHUB_SECRET} = process.env;
module.exports = class extends Base {
  async getAccessToken(code) {
    const params = {
      client_id: GITHUB_ID,
      client_secret: GITHUB_SECRET,
      code
    };

    return request.post({
      url: ACCESS_TOKEN_URL,
      headers: {'Accept': 'application/json'},
      form: params,
      json: true
    });
  }

  async getUserInfoByToken({access_token}) {
    const userInfo = await request.get({
      url: USER_INFO_URL,
      headers: {
        'User-Agent': '@waline',
        'Authorization': 'token ' + access_token
      },
      json: true
    });

    if(!userInfo.email) {
      const emails = await request.get({
        url: USER_EMAILS,
        headers: {
          'User-Agent': '@waline/auth',
          'Authorization': 'token ' + access_token
        },
        json: true
      });
      if(emails.length) {
        userInfo.email = emails[0].email;
      }
    }
    
    return {
      id: userInfo.login,
      name: userInfo.name || userInfo.login,
      email: userInfo.email,
      url: userInfo.blog || `https://github.com/${userInfo.login}`,
      avatar: userInfo.avatar_url,
    };
  }

  async redirect() {
    const {redirect, state} = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/github') + '?' + qs.stringify({redirect, state});

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: GITHUB_ID,
      redirect_uri: redirectUrl,
      scope: 'read:user,user:email'
    });
    return this.ctx.redirect(url);
  }
};
