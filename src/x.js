const Base = require('./base');
const crypto = require('crypto');
const qs = require('querystring');
const request = require('request-promise-native');

const OAUTH_URL = 'https://x.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const USER_INFO_URL = 'https://api.x.com/2/users/me';

const { TWITTER_ID, TWITTER_SECRET } = process.env;

const xHelpers = {
  // PKCE helpers
  base64url(buf) {
    return buf.toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  },
  
  generatePKCE() {
    const verifier = xHelpers.base64url(crypto.randomBytes(32));
    const challenge = xHelpers.base64url(
      crypto.createHash('sha256').update(verifier).digest()
    );
    return { verifier, challenge };
  },

  /**
   * Encode state data to base64 for stateless operation
   */
  encodeStateData(data) {
    return Buffer.from(JSON.stringify(data)).toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  },

  /**
   * Decode state data from base64
   */
  decodeStateData(encoded) {
    try {
      const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
      const decoded = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}

module.exports = class extends Base {
  static check() {
    return TWITTER_ID && TWITTER_SECRET;
  }

  static info() {
    return {
      origin: new URL(OAUTH_URL).hostname
    };
  }

  async redirect() {
    const { redirect, state } = this.ctx.params;
    const callbackUrl = this.getCompleteUrl('/x');

    const { verifier, challenge } = xHelpers.generatePKCE();

    // Encode all necessary state data (PKCE verifier, redirect URL, original state)
    const stateData = xHelpers.encodeStateData({
      verifier,
      redirect,
      state,
      callbackUrl
    });

    const params = {
      response_type: 'code',
      client_id: TWITTER_ID,
      redirect_uri: callbackUrl,
      scope: [
        'tweet.read',
        'users.read',
        'offline.access',
        'users.email'
      ].join(' '),
      state: stateData,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    };

    return this.ctx.redirect(OAUTH_URL + '?' + qs.stringify(params));
  }

  async getAccessToken({ code, stateData }) {
    const { verifier, callbackUrl } = stateData;
    const credentials = Buffer.from(`${TWITTER_ID}:${TWITTER_SECRET}`).toString('base64');

    return await request({
      url: TOKEN_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      form: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        code_verifier: verifier
      },
      json: true
    });
  }

  async getUserInfoByToken(access_token) {
    const url = USER_INFO_URL +
      '?user.fields=name,username,profile_image_url,url,confirmed_email';

    return await request({
      url,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`
      },
      json: true
    });
  }

  async getUserInfo() {
    const { code, state: encodedState } = this.ctx.params;

    if (!code || !encodedState) {
      return this.redirect();
    }

    this.ctx.type = 'json';

    const stateData = xHelpers.decodeStateData(encodedState);
    if (!stateData) {
      const err = new Error('OAuth state is invalid or could not be decoded.');
      err.statusCode = 400;
      throw err;
    }

    const { redirect } = stateData;
    if (redirect) {
      return this.ctx.redirect(
        redirect +
        (redirect.includes('?') ? '&' : '?') +
        qs.stringify({ code, state: encodedState })
      );
    }

    // 到这里：我们要进行 Token 交换 + 获取用户信息
    let tokenInfo;
    try {
      tokenInfo = await this.getAccessToken({ code, stateData });
    } catch (err) {
      err.message = err.message || 'Failed to obtain access token from Twitter.';
      err.statusCode = 500;
      throw err;
    }

    if (!tokenInfo || !tokenInfo.access_token) {
      const err = new Error('Twitter did not return an access token.');
      err.statusCode = 401;
      throw err;
    }

    // 获取用户信息
    let userInfo;
    try {
      userInfo = await this.getUserInfoByToken(tokenInfo.access_token);
    } catch (err) {
      err.message = err.message || 'Failed to fetch user info from Twitter.';
      err.statusCode = err.statusCode || 500;
      throw err;
    }

    const u = userInfo && userInfo.data ? userInfo.data : {};

    return {
      id: u.id,
      name: u.name || u.username,
      email: u.email || u.confirmed_email,
      url: u.url || (u.username ? `https://x.com/${u.username}` : undefined),
      avatar: u.profile_image_url || undefined,
      originalResponse: u
    };
  }
};