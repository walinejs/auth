const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

// Official Huawei OAuth endpoints (as suggested in your question)
const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const ACCESS_TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';
// Note: The User Info endpoint is not provided in the documents.
// Based on standard OAuth flows and Huawei's typical implementation, an endpoint like the one below is commonly used.
// You should verify the exact URL and response format in the official Huawei documentation.
const USER_INFO_URL = 'https://api.vmall.com/rest.php'; // Placeholder - CONFIRM with Huawei Docs

const { HUAWEI_ID, HUAWEI_SECRET } = process.env;

module.exports = class extends Base {
  static check() {
    // Checks if the required environment variables are configured
    return HUAWEI_ID && HUAWEI_SECRET;
  }

  static info() {
    return {
      origin: new URL(OAUTH_URL).hostname
    };
  }

  async getAccessToken(code) {
    const params = {
      client_id: HUAWEI_ID,
      client_secret: HUAWEI_SECRET,
      code,
      grant_type: 'authorization_code'
    };

    return request.post({
      url: ACCESS_TOKEN_URL,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      form: params,
      json: true
    });
  }

  async getUserInfoByToken({ access_token }) {
    // Document note: The documents do not specify Huawei's user info API endpoint or response format.
    // The following is a template based on common OAuth provider patterns and the structure required by `oauth.js`.
    // You MUST consult Huawei's official OAuth documentation to get the correct API endpoint, parameters, and response mapping.

    const userInfo = await request.get({
      url: USER_INFO_URL, // REPLACE with the correct endpoint from Huawei's docs
      headers: {
        'User-Agent': '@waline',
        'Authorization': 'Bearer ' + access_token
      },
      json: true
    });

    // Format the response to match the structure expected by `oauth.js` (similar to the `github.js` output).
    // The mapping below (id, name, email, etc.) is hypothetical. You must map the actual fields from Huawei's API response.
    return this.formatUserResponse({
      id: userInfo.openid || userInfo.sub || userInfo.user_id, // Use the correct unique user identifier field
      name: userInfo.name || userInfo.nickname || userInfo.display_name || 'Huawei User',
      email: userInfo.email || undefined,
      url: userInfo.profile || userInfo.link || undefined,
      avatar: userInfo.picture || userInfo.head_picture_url || userInfo.avatar_url,
      originalResponse: userInfo
    }, 'huawei');
  }

  async redirect() {
    const { redirect, state } = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/huawei') + '?' + qs.stringify({ redirect, state });

    const url = OAUTH_URL + '?' + qs.stringify({
      client_id: HUAWEI_ID,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: 'openid profile', // Confirm the required scopes with Huawei's documentation
      state: state,
      access_type: 'offline'
    });
    return this.ctx.redirect(url);
  }
};