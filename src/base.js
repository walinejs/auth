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
    console.log('[base] formatUserResponse called:', { platform, id: userInfo && userInfo.id });

    const TIMEOUT_MS = parseInt(process.env.FORMAT_USER_DB_WAIT_MS || '1800', 10);

    // Attempt DB upsert but do NOT allow it to block the response > TIMEOUT_MS
    try {
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
            console.log('[base] storage.upsertThirdPartyInfo returned:', ok);
          } catch (err) {
            console.error('[base] storage.upsertThirdPartyInfo threw (caught):', err && err.message);
          }
        })(),
        sleep(TIMEOUT_MS)
      ]);
    } catch (err) {
      // should be rare: Promise.race will only reject if both sides reject
      console.error('[base] upsert race error (ignored):', err && err.message);
    }

    // Build Waline response defensively
    try {
      const response = createUserResponse(userInfo, platform);
      if (response && typeof response.get === 'function') {
        const out = response.get();
        if (out == null) {
          console.warn('[base] response.get() returned null/undefined; using fallback');
          return { ok: true, platform, id: userInfo && userInfo.id, name: userInfo && userInfo.name || null };
        }
        return out;
      }
      if (response == null) {
        console.warn('[base] createUserResponse returned null/undefined; using fallback');
        return { ok: true, platform, id: userInfo && userInfo.id, name: userInfo && userInfo.name || null };
      }
      return response;
    } catch (err) {
      console.error('[base] createUserResponse failed:', err && err.message);
      if (err && err.stack) console.error(err.stack);
      return { ok: false, error: 'formatUserResponse_failed' };
    }
  }
};