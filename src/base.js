const { createUserResponse } = require('./utils');
const { waitUntil } = require('@vercel/functions');
const storage = require('./utils/storage/db');

module.exports = class {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async formatUserResponse(userInfo, platform = '') {
    console.log('[base] formatUserResponse called:', platform);

    // This is the ONLY way to do "fire-and-forget" safely on Vercel
    waitUntil(
      storage.upsertThirdPartyInfo(platform, userInfo)
        .then(ok => console.log('[base] DB update result:', ok))
        .catch(err => console.error('[base] DB background error:', err.message))
    );

    // Return response immediately - the function stays alive in the background
    return createUserResponse(userInfo, platform).get();
  }

  getCompleteUrl(url = '') {
    const { SERVER_URL } = process.env;
    const protocol = this.ctx?.header?.['x-forwarded-proto'] || 'http';
    const host = this.ctx?.header?.['x-forwarded-host'] || this.ctx?.host || '';
    const baseUrl = SERVER_URL || `${protocol}://${host}`;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return baseUrl + cleanUrl;
  }
};