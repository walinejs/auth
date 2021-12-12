const qs = require('querystring');
module.exports = class {
  constructor(ctx) {
    this.ctx = ctx;
  }

  getCompleteUrl(url = '') {
    const protocol = this.ctx.header['x-forwarded-proto'] || 'http';
    const host = this.ctx.header['x-forwarded-host'] || this.ctx.host;
    if (!/^\//.test(url)) {
      url = '/' + url;
    }
    return protocol + '://' + host + url;
  }

  async getUserInfo() {
    const {code, redirect, state} = this.ctx.params;
    if(!code) {
      return this.redirect();
    }

    if(redirect) {
      return this.ctx.redirect(redirect + (redirect.includes('?') ? '&' : '?') + qs.stringify({ code, state }));
    }

    this.ctx.type = 'json';
    const accessTokenInfo = await this.getAccessToken(code);
    const userInfo = await this.getUserInfoByToken(accessTokenInfo);
    return this.ctx.body = userInfo;
  }
};