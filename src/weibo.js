const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://api.weibo.com/oauth2/authorize';
const ACCESS_TOKEN_URL = 'https://api.weibo.com/oauth2/access_token';
const TOKEN_INFO_URL = 'https://api.weibo.com/oauth2/get_token_info';
const USER_INFO_URL = 'https://api.weibo.com/2/users/show.json';

const {WEIBO_ID, WEIBO_SECRET} = process.env;
module.exports = class extends Base {
  redirect() {
    const {redirect, state} = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/weibo') + '?' + qs.stringify({redirect, state});

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: WEIBO_ID,
      redirect_uri: redirectUrl,
      response_type: 'code'
    });
    return this.ctx.redirect(url);
  }

  async getAccessToken(code) {
    const redirectUrl = this.getCompleteUrl('/weibo');
    const params = {
      client_id: WEIBO_ID,
      client_secret: WEIBO_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUrl
    };

    return request.post({
      url: ACCESS_TOKEN_URL,
      form: params,
      json: true
    });
  }

  async getUserInfoByToken({access_token}) {
    const tokenInfo = await request.post({
      url: TOKEN_INFO_URL,
      form: { access_token },
      json: true,
    });
    const userInfo = await request.get(USER_INFO_URL + '?' + qs.stringify({access_token, uid: tokenInfo.uid}), {json: true});
    return {
      id: userInfo.idstr,
      name: userInfo.screen_name || userInfo.name,
      email: '',
      url: userInfo.url || `https://weibo.com/u/${userInfo.id}`,
      avatar: userInfo.avatar_large || userInfo.profile_image_url,
    }
  }
}