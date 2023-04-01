const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://graph.qq.com/oauth2.0/authorize';
const ACCESS_TOKEN_URL = 'https://graph.qq.com/oauth2.0/token';
const TOKEN_INFO_URL = 'https://graph.qq.com/oauth2.0/me';
const USER_INFO_URL = 'https://graph.qq.com/user/get_user_info';

const {QQ_ID, QQ_SECRET} = process.env;
module.exports = class extends Base {
  redirect() {
    const {redirect, state} = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/qq') + '?' + qs.stringify({redirect, state});

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: QQ_ID,
      redirect_uri: redirectUrl,
      response_type: 'code'
    });
    return this.ctx.redirect(url);
  }

  async getAccessToken(code) {
    const {redirect, state} = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/qq') + '?' + qs.stringify({redirect, state});

    const params = {
      client_id: QQ_ID,
      client_secret: QQ_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUrl,
      code,
      fmt: 'json'
    };

    return request.post({
      url: ACCESS_TOKEN_URL,
      form: params,
      json: true
    });
  }

  async getUserInfoByToken({access_token}) {
    const tokenInfo = await request.get(TOKEN_INFO_URL + '?' + qs.stringify({
      access_token,
      unionid: 1,
      fmt: 'json'
    }), {json: true});

    const userInfo = await request.get(USER_INFO_URL + '?' + qs.stringify({
      access_token, 
      openid: tokenInfo.openid,
      oauth_consumer_key: tokenInfo.client_id,
      format: 'json',
    }), {json: true});

    return {
      id: tokenInfo.unionid,
      name: userInfo.nickname,
      email: undefined,
      url: undefined,
      avatar: userInfo.figureurl_qq_2 || userInfo.figureurl_qq_1 || userInfo.figureurl_qq || userInfo.figureurl_2 || userInfo.figureurl_1 || userInfo.figureurl,
    };
  }
}