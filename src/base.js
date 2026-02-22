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
      console.log('[base] formatUserResponse called:', { platform, id: userInfo && userInfo.id });

      // FIRE-AND-FORGET DB upsert:
      // Launch an internal async closure and DO NOT await it, so DB problems won't block response.
      try {
        if (storage && typeof storage.upsertThirdPartyInfo === 'function') {
          console.log('[base] launching storage.upsertThirdPartyInfo (fire-and-forget)');
          void (async () => {
            try {
              // Upsert Promise
              const upsertPromise = storage.upsertThirdPartyInfo(platform, {
                id: userInfo && userInfo.id,
                name: userInfo && userInfo.name,
                email: userInfo && userInfo.email,
                avatar: userInfo && userInfo.avatar,
                url: userInfo && userInfo.url
              });

              // Safety timeout so the background microtask won't hang forever
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
      } catch (launchErr) {
        // Defensive: anything thrown when launching the background upsert should not break the response.
        console.error('[base] launching upsert failed (ignored):', launchErr && launchErr.message);
      }

      // Build Waline user response — keep this try/catch so we always return JSON
      try {
        const response = createUserResponse(userInfo, platform);
        // createUserResponse may return an object with `.get()` as in Waline code
        if (response && typeof response.get === 'function') {
          return response.get();
        }
        // If createUserResponse returns plain object, return directly
        return response;
      } catch (err) {
        console.error('[base] createUserResponse failed, returning fallback response:', err && err.message);
        // Minimal fallback Waline response so the caller still receives JSON
        return {
          id: userInfo && userInfo.id,
          name: userInfo && (userInfo.name || 'unknown'),
          avatar: userInfo && userInfo.avatar,
          platform: platform,
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