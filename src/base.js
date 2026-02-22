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

  /**
   * formatUserResponse: attempt DB upsert but always return JSON.
   * We await upsert with a strict timeout so Vercel won't hang.
   */
  async formatUserResponse(userInfo, platform = '') {
    console.log('[base] formatUserResponse called:', { platform, id: userInfo && userInfo.id });

    // Attempt DB upsert but do not allow it to block > TIMEOUT_MS
    const TIMEOUT_MS = 1500;

    // If storage.upsertThirdPartyInfo returns/throws, swallow errors.
    try {
      // Promise.race: either DB operation finishes or timeout resolves
      await Promise.race([
        (async () => {
          try {
            const ok = await storage.upsertThirdPartyInfo(platform, {
              id: userInfo && userInfo.id,
              name: userInfo && userInfo.name,
              email: userInfo && userInfo.email,
              avatar: userInfo && userInfo.avatar,
              url: userInfo && userInfo.url
            });
            console.log('[base] upsertThirdPartyInfo returned:', ok);
          } catch (err) {
            console.error('[base] upsertThirdPartyInfo threw (caught):', err && err.message);
          }
        })(),
        sleep(TIMEOUT_MS)
      ]);
    } catch (err) {
      // This shouldn't normally run because we race against sleep, but catch defensively
      console.error('[base] upsert race error (ignored):', err && err.message);
    }

    // Build Waline response — defensively catch errors and ensure non-null result
    try {
      const response = createUserResponse(userInfo, platform);
      if (!response) {
        console.warn('[base] createUserResponse returned null/undefined; returning fallback object');
        return {
          ok: true,
          platform,
          id: userInfo && userInfo.id,
          name: userInfo && (userInfo.name || null),
          avatar: userInfo && userInfo.avatar
        };
      }
      if (typeof response.get === 'function') {
        try {
          const out = response.get();
          if (out == null) {
            console.warn('[base] response.get() returned null/undefined; using fallback');
            return {
              ok: true,
              platform,
              id: userInfo && userInfo.id,
              name: userInfo && (userInfo.name || null),
              avatar: userInfo && userInfo.avatar
            };
          }
          return out;
        } catch (err) {
          console.error('[base] response.get() threw:', err && err.message);
          return {
            ok: true,
            platform,
            id: userInfo && userInfo.id,
            name: userInfo && (userInfo.name || null),
            avatar: userInfo && userInfo.avatar
          };
        }
      } else {
        // response is a plain object
        return response;
      }
    } catch (err) {
      console.error('[base] createUserResponse fatal error (caught):', err && err.message);
      if (err && err.stack) console.error(err.stack);
      return {
        ok: false,
        error: 'formatUserResponse_failed'
      };
    }
  }
};