const { createUserResponse } = require('./utils');
const storage = require('./utils/storage/db');

module.exports = class {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async formatUserResponse(userInfo, platform = '') {
    console.log('[base] formatUserResponse called:', platform);

    /**
     * FIRE-AND-FORGET (SAFE)
     * We trigger the promise but do NOT 'await' it. 
     * We attach a .catch() to ensure an error doesn't kill the Node process.
     */
    storage.upsertThirdPartyInfo(platform, userInfo)
      .then(ok => console.log('[base] db background task finished. Success:', ok))
      .catch(err => console.error('[base] db background task crashed:', err.message));

    // Return the JSON response to the user immediately
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