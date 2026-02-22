// base.js
// Wrapper for third-party login formatting. Best-effort DB write (fire-and-forget).
// Always returns a JSON-like Waline user response (never block on DB).

const qs = require('querystring');
const { createErrorResponse, createUserResponse } = require('./utils');
const storage = require('./utils/storage/db'); // your storage module (CommonJS)

module.exports = class {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Get the complete server URL for OAuth callbacks
   * @param {string} url - Relative URL path
   * @returns {string} Complete URL
   */
  getCompleteUrl(url = '') {
    const { SERVER_URL } = process.env;
    const protocol =
      this.ctx && this.ctx.header && (this.ctx.header['x-forwarded-proto'] || 'http');
    const host = this.ctx && (this.ctx.header && this.ctx.header['x-forwarded-host'] || (this.ctx.host || ''));

    const baseUrl = SERVER_URL || protocol + '://' + host;
    if (!/^\//.test(url)) {
      url = '/' + url;
    }
    return baseUrl + url;
  }

  /**
   * Format user info with platform name
   * Attempts to store/upsert third-party info to DB in best-effort mode.
   * Returns the Waline formatted user response even if DB fails or times out.
   */
  async formatUserResponse(userInfo, platform = '') {

    try {

      console.log('[base] formatUserResponse called:', platform);

      try {

        await Promise.race([
          storage.upsertThirdPartyInfo(platform, userInfo),
          new Promise(resolve => setTimeout(resolve, 1500))
        ]);

      } catch (e) {

        console.error('[base] DB write ignored:', e.message);

      }

      const response = createUserResponse(userInfo, platform);

      return response.get();

    } catch (error) {

      console.error(error);

      return {
        ok: false
      };

    }

  }
};