// base.js
const qs = require('querystring');
const { createErrorResponse, createUserResponse } = require('./utils');
const storage = require('./utils/storage/db');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = class {
  constructor(ctx) {
    this.ctx = ctx;
  }

  getCompleteUrl(url = '') {
    const { SERVER_URL } = process.env;
    const protocol =
      this.ctx && this.ctx.header && (this.ctx.header['x-forwarded-proto'] || 'http');
    const host = this.ctx && (this.ctx.header && this.ctx.header['x-forwarded-host'] || (this.ctx.host || ''));
    const baseUrl = SERVER_URL || protocol + '://' + host;
    if (!/^\//.test(url)) url = '/' + url;
    return baseUrl + url;
  }

  async formatUserResponse(userInfo, platform = '') {
    console.log('[base] formatUserResponse called:', platform);

    // Use waitUntil instead of setImmediate
    waitUntil(
      storage.upsertThirdPartyInfo(platform, userInfo)
        .then(ok => console.log('[base] db result:', ok))
        .catch(err => console.error('[base] db error:', err.message))
    );

    return createUserResponse(userInfo, platform).get();
  }
};