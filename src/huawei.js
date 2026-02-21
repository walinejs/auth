const Base = require('./base.js');
const jwtDecode = require('jwt-decode');

const {
  HUAWEI_ID,
  HUAWEI_SECRET
} = process.env;

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';

module.exports = class extends Base {

  /**
   * Step 1: Redirect user to Huawei OAuth
   */
  async getRedirectUrl({ redirect, state }) {
    const query = {
      client_id: HUAWEI_ID,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'openid profile email',
      state
    };

    return `${OAUTH_URL}?${this.buildQueryString(query)}`;
  }

  /**
   * Step 2: Exchange code for access_token + id_token
   */
  async getAccessToken({ code, redirect }) {

    const body = this.buildQueryString({
      grant_type: 'authorization_code',
      code,
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      redirect_uri: redirect
    });

    const res = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': '@waline'
      },
      body
    });

    const data = await res.json();

    if (!data.access_token || !data.id_token) {
      throw new Error('Failed to get Huawei access_token');
    }

    return data;
  }

  /**
   * Step 3: Decode id_token to get user info
   */
  async getUser({ access_token, id_token }) {

    // Huawei returns user info in id_token (JWT)
    const decoded = jwtDecode(id_token);

    /**
     * Huawei ID token fields:
     * sub      = user id
     * email    = email
     * picture  = avatar
     * name     = display name (sometimes missing)
     */

    return {
      id: decoded.sub,
      name: decoded.name || decoded.email || `huawei_${decoded.sub}`,
      email: decoded.email || null,
      avatar: decoded.picture || null,
      url: null
    };
  }

};