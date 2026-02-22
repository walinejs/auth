// base.js (only the updated part shown)
const qs = require('querystring');
const { createErrorResponse, createUserResponse } = require('./utils');
const storage = require('./utils/storage/db');

module.exports = class {
  constructor(ctx) {
    this.ctx = ctx;
  }

  getCompleteUrl(url = '') {
    const { SERVER_URL } = process.env;
    const protocol = this.ctx.header['x-forwarded-proto'] || 'http';
    const host = this.ctx.header['x-forwarded-host'] || this.ctx.host;

    const baseUrl = SERVER_URL || protocol + '://' + host;
    if (!/^\//.test(url)) {
      url = '/' + url;
    }
    return baseUrl + url;
  }

  /**
   * Format user info with platform name
   * Now also attempts to store/upsert third-party info to DB (best-effort).
   */
  async formatUserResponse(userInfo, platform = '') {
    try {
      console.log('[base] formatUserResponse called:', { platform, id: userInfo && userInfo.id });

      // Fire-and-check DB upsert (best-effort). We await it so we can log its result,
      // but any failures are swallowed inside storage.upsertThirdPartyInfo (it returns false).
      try {
        const ok = await storage.upsertThirdPartyInfo(platform, {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          avatar: userInfo.avatar,
          url: userInfo.url
        });
        if (!ok) {
          console.warn('[base] upsertThirdPartyInfo returned false for', platform, userInfo.id);
        } else {
          console.log('[base] upsertThirdPartyInfo succeeded for', platform, userInfo.id);
        }
      } catch (err) {
        // In case storage module throws unexpectedly (shouldn't), protect flow.
        console.error('[base] upsertThirdPartyInfo fatal error (ignored):', err && err.message);
      }

      // Continue returning the normal Waline-formatted user
      const response = createUserResponse(userInfo, platform);
      return response.get();
    } catch (error) {
      // If createUserResponse throws (unlikely), we still bubble up — Waline expects errors here.
      console.error('[base] formatUserResponse error:', error && error.message);
      throw error;
    }
  }
};