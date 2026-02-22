const { createUserResponse } = require('./utils');
const storage = require('./utils/storage/db');

module.exports = class {

  constructor(ctx) {
    this.ctx = ctx;
  }

  async formatUserResponse(userInfo, platform = '') {

    console.log('[base] formatUserResponse called:', platform);

    // fire-and-forget, never block response
    setImmediate(() => {

      storage.upsertThirdPartyInfo(platform, userInfo)
        .then(ok => {
          console.log('[base] db result:', ok);
        })
        .catch(err => {
          console.error('[base] db error:', err.message);
        });

    });

    // RETURN RESPONSE IMMEDIATELY
    return createUserResponse(userInfo, platform).get();

  }

};