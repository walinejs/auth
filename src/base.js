// base.js
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
    const protocol = this.ctx && this.ctx.header && (this.ctx.header['x-forwarded-proto'] || 'http');
    const host = this.ctx && (this.ctx.header && this.ctx.header['x-forwarded-host'] || (this.ctx.host || ''));

    const baseUrl = SERVER_URL || protocol + '://' + host;
    if (!/^\//.test(url)) {
      url = '/' + url;
    }
    return baseUrl + url;
  }

  /**
   * Format user info with platform name
   * Now also attempts to store/upsert third-party info to DB (best-effort).
   * Always returns the Waline formatted user response even if DB fails.
   */
  async formatUserResponse(userInfo, platform = '') {
    try {
      console.log('[base] formatUserResponse called:', { platform, id: userInfo && userInfo.id });

      // Attempt DB upsert in best-effort mode.
      try {
        if (storage && typeof storage.upsertThirdPartyInfo === 'function') {
          console.log('[base] calling storage.upsertThirdPartyInfo...');
          const ok = await storage.upsertThirdPartyInfo(platform, {
            id: userInfo && userInfo.id,
            name: userInfo && userInfo.name,
            email: userInfo && userInfo.email,
            avatar: userInfo && userInfo.avatar,
            url: userInfo && userInfo.url
          });
          if (ok) {
            console.log('[base] upsertThirdPartyInfo succeeded for', platform, userInfo && userInfo.id);
          } else {
            console.warn('[base] upsertThirdPartyInfo returned false for', platform, userInfo && userInfo.id);
          }
        } else {
          console.warn('[base] storage.upsertThirdPartyInfo not available; skipping DB upsert');
        }
      } catch (dbErr) {
        // swallow DB errors so login flow continues
        console.error('[base] upsertThirdPartyInfo error (ignored):', dbErr && dbErr.message);
        if (dbErr && dbErr.stack) {
          console.error(dbErr.stack);
        }
      }

      // Build Waline user response
      const response = createUserResponse(userInfo, platform);
      return response.get();
    } catch (error) {
      console.error('[base] formatUserResponse fatal error:', error && error.message);
      if (error && error.stack) console.error(error.stack);
      // Re-throw because caller may rely on exceptions from createUserResponse
      throw error;
    }
  }
};