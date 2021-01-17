const Base = require('./base');
const crypto = require('crypto');
const qs = require('querystring');
const OAuth = require('oauth-1.0a');
const Storage = require('./utils/storage/leancloud');
const request = require('request-promise-native');

const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const OAUTH_URL = 'https://api.twitter.com/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';

const {TWITTER_ID, TWITTER_SECRET} = process.env;
module.exports = class extends Base {
  constructor(ctx) {
    super(ctx);
    this._session = new Storage('twitter');
    this._oauth = OAuth({
      consumer: {
        key: TWITTER_ID,
        secret: TWITTER_SECRET
      },
      signature_method: 'HMAC-SHA1',
      hash_function: (baseString, key) => {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64')
      }
    });
  }

  async getAccessToken({oauth_verifier, oauth_token}) {
    const oauth_token_secret = await this._session.get(oauth_token);
    if(!oauth_token_secret) {
      return {};
    }

    const requestData = {
      url: ACCESS_TOKEN_URL,
      method: 'POST',
      data: {
        oauth_token,
        oauth_verifier,
        oauth_token_secret
      }
    };
    
    const resp = await request({
      ...requestData,
      form: requestData.data,
      headers: this._oauth.toHeader(this._oauth.authorize(requestData))
    });
    return qs.parse(resp);
  }

  async redirect() {
    const {redirect, state} = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/twitter') + '?' + qs.stringify({redirect, state});

    const requestData = {
      url: REQUEST_TOKEN_URL,
      method: 'POST',
      data: {
        oauth_callback: redirectUrl
      }
    };
    const requestToken = await request({
      ...requestData,
      form: requestData.data,
      headers: this._oauth.toHeader(this._oauth.authorize(requestData))
    });
    
    const {oauth_token, oauth_token_secret} = qs.parse(requestToken);
    
    await this._session.set(oauth_token, oauth_token_secret);

    const url = OAUTH_URL + '?' + qs.stringify({oauth_token});
    return this.ctx.redirect(url);
  }

  async getUserInfo() {
    const {oauth_verifier, oauth_token, redirect} = this.ctx.params;
    if(!oauth_verifier || !oauth_token) {
      return this.redirect();
    }

    if(redirect) {
      return this.ctx.redirect(redirect + (redirect.includes('?') ? '&' : '?') + qs.stringify({oauth_verifier, oauth_token}));
    }

    const userInfo = await this.getAccessToken({oauth_verifier, oauth_token});
    return this.ctx.body = {
      user_id: userInfo.user_id,
      screen_name: userInfo.screen_name
    };
  }
};