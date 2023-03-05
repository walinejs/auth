const Base = require('./base');
const crypto = require('crypto');
const qs = require('querystring');
const OAuth = require('oauth-1.0a');
const oauthSign = require('oauth-sign');
const uuid = require('uuid');
const Storage = require('./utils/storage/leancloud');
const request = require('request-promise-native');

const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const OAUTH_URL = 'https://api.twitter.com/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';
const USER_INFO_URL = 'https://api.twitter.com/1.1/account/verify_credentials.json';

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

  async getUserInfoByToken({ oauth_token, oauth_token_secret }) {
    const url = USER_INFO_URL;
    const consumerKey = TWITTER_ID;
    const consumerSecretKey = TWITTER_SECRET;
  
    const oauthToken = oauth_token;
    const oauthTokenSecret = oauth_token_secret;
  
    const timestamp = Date.now() / 1000;
    const nonce = uuid.v4().replace(/-/g, '');
  
    const params = {
      include_email: true,
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: oauthToken,
      oauth_version: '1.0'
    };
  
    params.oauth_signature = oauthSign.hmacsign('GET', url, params, consumerSecretKey, oauthTokenSecret);
  
    const auth = Object.keys(params).sort().map(function (k) {
      return k + '="' + oauthSign.rfc3986(params[k]) + '"';
    }).join(', ');
  
    const resp = await request({
      url: url + '?include_email=true',
      headers: {
        Authorization: 'OAuth ' + auth
      },
      json: true
    });
    return resp;
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
    const {oauth_verifier, oauth_token, redirect, state} = this.ctx.params;
    if(!oauth_verifier || !oauth_token) {
      return this.redirect();
    }

    if(redirect && this.ctx.headers['user-agent'] !== '@waline') {
      return this.ctx.redirect(redirect + (redirect.includes('?') ? '&' : '?') + qs.stringify({oauth_verifier, oauth_token, state}));
    }

    // { oauth_token, oauth_token_secret, user_id, screen_name }
    this.ctx.type = 'json';
    const accessTokenInfo = await this.getAccessToken({oauth_verifier, oauth_token});
    const userInfo = await this.getUserInfoByToken(accessTokenInfo);
    return this.ctx.body = {
      id: userInfo.id_str, // https://stackoverflow.com/questions/4132900/url-link-to-twitter-user-with-id-not-name
      name: userInfo.name,
      email: userInfo.email,
      url: userInfo.url || `https://twitter.com/i/user/${userInfo.id_str}`,
      avatar: userInfo.profile_image_url_https,
    };
  }
};