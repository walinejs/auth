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

      // Fire-and-forget DB upsert with short timeout (best-effort)
      try {
        if (storage && typeof storage.upsertThirdPartyInfo === 'function') {
          console.log('[base] launching storage.upsertThirdPartyInfo (fire-and-forget)');
          // do not await — make it truly best-effort
          void (async () => {
            try {
              // Optional: wrap in small timeout so a stuck query won't hang this microtask either
              const upsertPromise = storage.upsertThirdPartyInfo(platform, {
                id: userInfo && userInfo.id,
                name: userInfo && userInfo.name,
                email: userInfo && userInfo.email,
                avatar: userInfo && userInfo.avatar,
                url: userInfo && userInfo.url
              });

              // small safety timeout (ms)
              const TIMEOUT_MS = 1500;
              const result = await Promise.race([
                upsertPromise,
                new Promise(resolve => setTimeout(() => resolve(false), TIMEOUT_MS))
              ]);

              if (result) {
                console.log('[base] upsertThirdPartyInfo succeeded for', platform, userInfo && userInfo.id);
              } else {
                console.warn('[base] upsertThirdPartyInfo returned false or timed out for', platform, userInfo && userInfo.id);
              }
            } catch (err) {
              console.error('[base] upsertThirdPartyInfo inner error (ignored):', err && err.message);
            }
          })();
        } else {
          console.warn('[base] storage.upsertThirdPartyInfo not available; skipping DB upsert');
        }
      } catch (dbErr) {
        // defensive — should never happen because inner closure already catches
        console.error('[base] launching upsert failed (ignored):', dbErr && dbErr.message);
      }

      // Build Waline user response — wrap defensively so we always return JSON-like object
      try {
        const response = createUserResponse(userInfo, platform);
        return response.get();
      } catch (err) {
        console.error('[base] createUserResponse failed, returning fallback response:', err && err.message);
        // return a minimal fallback Waline response so caller still gets JSON
        return {
          id: userInfo && userInfo.id,
          name: userInfo && (userInfo.name || 'unknown'),
          avatar: userInfo && userInfo.avatar,
          platform: platform,
          // other Waline expected fields — adapt as needed
          ok: false,
          _error: 'createUserResponse_failed'
        };
      }
    } catch (error) {
      console.error('[base] formatUserResponse fatal error (unexpected):', error && error.message);
      if (error && error.stack) console.error(error.stack);
      // As a last resort return a JSON error object rather than throwing
      return { ok: false, error: 'formatUserResponse_fatal' };
    }
  }
};