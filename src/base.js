const { createUserResponse } = require('./utils');
const storage = require('./utils/storage/db');
const vercelFunctions = require('@vercel/functions');

module.exports = class {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async formatUserResponse(userInfo, platform = '') {
    console.log('[base] formatUserResponse called:', platform);

    // 1. Safe background task execution
    const task = storage.upsertThirdPartyInfo(platform, userInfo)
      .then(ok => console.log('[base] DB update result:', ok))
      .catch(err => console.error('[base] DB background error:', err.message));

    // 2. Try to use waitUntil if available, otherwise just let it float
    if (vercelFunctions && typeof vercelFunctions.waitUntil === 'function') {
      vercelFunctions.waitUntil(task);
    } else {
      console.warn('[base] waitUntil not found, task may be suspended');
    }

    // 3. Construct response
    const response = createUserResponse(userInfo, platform);
    const result = response.get ? response.get() : response;

    // 4. THIS LOG MUST APPEAR
    console.log('[base] Returning response data:', JSON.stringify(result));
    
    return result;
  }

  getCompleteUrl(url = '') {
    const { SERVER_URL } = process.env;
    const protocol = this.ctx?.header?.['x-forwarded-proto'] || 'http';
    const host = this.ctx?.header?.['x-forwarded-host'] || this.ctx?.host || '';
    const baseUrl = SERVER_URL || `${protocol}://${host}`;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return baseUrl + cleanUrl;
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
    try {
      const accessTokenInfo = await this.getAccessToken(code);
      const userInfo = await this.getUserInfoByToken(accessTokenInfo);
      return this.ctx.body = userInfo;
    } catch (error) {
      this.ctx.status = error.statusCode || 500;
      this.ctx.body = createErrorResponse(error.message, this.ctx.status).toJSON();
    }
  }
};