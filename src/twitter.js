const Base = require('./base');
const crypto = require('crypto');
const qs = require('querystring');
const request = require('request-promise-native');

const AUTH_URL = 'https://x.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const USER_INFO_URL = 'https://api.x.com/2/users/me';

const TWITTER_CLIENT_ID = process.env.TWITTER_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_SECRET;

// PKCE helpers
function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generatePKCE() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(
    crypto.createHash('sha256').update(verifier).digest()
  );
  return { verifier, challenge };
}

/**
 * Encode state data to base64 for stateless operation
 */
function encodeStateData(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Decode state data from base64
 */
function decodeStateData(encoded) {
  try {
    const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
    const decoded = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

module.exports = class extends Base {
  static check() {
    return TWITTER_CLIENT_ID && TWITTER_CLIENT_SECRET;
  }

  static info() {
    return {
      origin: new URL(AUTH_URL).hostname
    };
  }

  async redirect() {
    const { redirect, state } = this.ctx.params;
    const callbackUrl = this.getCompleteUrl('/twitter');

    const { verifier, challenge } = generatePKCE();

    // Encode all necessary state data (PKCE verifier, redirect URL, original state)
    const stateData = encodeStateData({
      verifier,
      redirect,
      state,
      callbackUrl
    });

    const params = {
      response_type: 'code',
      client_id: TWITTER_CLIENT_ID,
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

    return this.ctx.redirect(AUTH_URL + '?' + qs.stringify(params));
  }

  async getAccessToken({ code, stateData }) {
    const { verifier, callbackUrl } = stateData;
    const credentials = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64');

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

    // 检查客户端是否期待 JSON
    const wantsJSON = (
      (this.ctx.headers.accept || '').includes('application/json') ||
      this.ctx.headers['user-agent'] === '@waline'
    );

    // 如果没有 code 或 state，则
    if (!code || !encodedState) {
      if (wantsJSON) {
        this.ctx.status = 400;
        this.ctx.body = {
          error: 'missing_code_or_state',
          message: 'OAuth callback requires both code and state parameters.'
        };
        return;
      }
      // 浏览器访问 → 重定向去授权
      return this.redirect();
    }

    this.ctx.type = 'json';

    // 尝试 decode state（用于 PKCE）
    const stateData = decodeStateData(encodedState);
    if (!stateData) {
      this.ctx.status = 400;
      this.ctx.body = { 
        error: 'invalid_state',
        message: 'OAuth state is invalid or could not be decoded.'
      };
      return;
    }

    const { redirect } = stateData;

    // 区分 fetch 还是浏览器访问
    const isBrowser = !wantsJSON;

    // 如果是浏览器访问，并且 redirect 有值，则跳回客户端（带 code & state）
    if (isBrowser && redirect) {
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
      this.ctx.status = 500;
      this.ctx.body = {
        error: 'token_exchange_failed',
        message: err.message || 'Failed to obtain access token from Twitter.',
        details: err.error || null
      };
      return;
    }

    if (!tokenInfo || !tokenInfo.access_token) {
      this.ctx.status = 401;
      this.ctx.body = {
        error: 'no_access_token',
        message: 'Twitter did not return an access token.',
        raw: tokenInfo
      };
      return;
    }

    // 获取用户信息
    let userInfo;
    try {
      userInfo = await this.getUserInfoByToken(tokenInfo.access_token);
    } catch (err) {
      this.ctx.status = 500;
      this.ctx.body = {
        error: 'user_info_fetch_failed',
        message: err.message || 'Failed to fetch user info from Twitter.',
        details: err.error || null
      };
      return;
    }

    const u = userInfo && userInfo.data ? userInfo.data : {};

    // 返回结构化的 JSON 用户信息
    this.ctx.status = 200;
    this.ctx.body = this.formatUserResponse({
      id: u.id,
      name: u.name || u.username,
      email: u.email || u.confirmed_email || `${u.id}@twitter-uuid.com`,
      url: u.url || (u.username ? `https://twitter.com/${u.username}` : undefined),
      avatar: u.profile_image_url || undefined,
      originalResponse: u
    }, 'twitter');
  }

};
