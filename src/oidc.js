const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const { OIDC_ID, OIDC_SECRET, OIDC_ISSUER, OIDC_SCOPES, OIDC_AUTH_URL, OIDC_TOKEN_URL, OIDC_USERINFO_URL } = process.env;

let discovery;
async function getDiscovery() {
  if (discovery) return discovery;
  const issuer = (OIDC_ISSUER || '').replace(/\/+$/, '');
  if (!issuer && !(OIDC_AUTH_URL && OIDC_TOKEN_URL && OIDC_USERINFO_URL)) {
    throw new Error('Missing OIDC_ISSUER or explicit endpoints');
  }
  if (OIDC_AUTH_URL && OIDC_TOKEN_URL && OIDC_USERINFO_URL) {
    discovery = {
      authorization_endpoint: OIDC_AUTH_URL,
      token_endpoint: OIDC_TOKEN_URL,
      userinfo_endpoint: OIDC_USERINFO_URL,
    };
    return discovery;
  }
  const url = issuer + '/.well-known/openid-configuration';
  discovery = await request.get(url, { json: true });
  return discovery;
}

module.exports = class extends Base {
  async redirect() {
    const { redirect, state } = this.ctx.params;
    const redirectUrl = this.getCompleteUrl('/oidc');
    const { authorization_endpoint } = await getDiscovery();
    const url = authorization_endpoint + '?' + qs.stringify({
      client_id: OIDC_ID,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: OIDC_SCOPES || 'openid profile email',
      state: qs.stringify({ redirect, state }),
    });
    return this.ctx.redirect(url);
  }

  async getAccessToken(code) {
    const redirectUrl = this.getCompleteUrl('/oidc');
    const { token_endpoint } = await getDiscovery();
    const params = {
      client_id: OIDC_ID,
      client_secret: OIDC_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUrl,
    };
    return request.post({
      url: token_endpoint,
      form: params,
      json: true,
    });
  }

  async getUserInfoByToken({ access_token }) {
    const { userinfo_endpoint } = await getDiscovery();
    const user = await request({
      url: userinfo_endpoint,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      json: true,
    });
    const rawAvatar = user.picture || user.avatar;
    const avatar = typeof rawAvatar === 'string'
      ? rawAvatar.trim().replace(/^`+|`+$/g, '').replace(/^\"+|\"+$/g, '')
      : undefined;
    const profileUrl = user.profile || user.website || (typeof user.url === 'string' ? user.url : '');
    return {
      id: user.sub,
      name: user.name || user.preferred_username || user.nickname,
      email: user.email,
      url: profileUrl || '',
      avatar,
    };
  }

  async getUserInfo() {
    const { code, state: _state } = this.ctx.params;
    const { redirect, state } = qs.parse(_state);
    if (!code) {
      return this.redirect();
    }
    if (redirect && this.ctx.headers['user-agent'] !== '@waline') {
      return this.ctx.redirect(redirect + (redirect.includes('?') ? '&' : '?') + qs.stringify({ code, state }));
    }
    this.ctx.type = 'json';
    const accessTokenInfo = await this.getAccessToken(code);
    const userInfo = await this.getUserInfoByToken(accessTokenInfo);
    return this.ctx.body = userInfo;
  }
};
