const { createUserResponse,createErrorResponse } = require('./utils');
const qs = require('querystring');
const storage = require('./utils/storage/db');

module.exports = class {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async formatUserResponse(userInfo, platform = '') {
    if (process.env.POSTGRES_URL) {
      try {
        const { waitUntil } = require('@vercel/functions');
        waitUntil(
          storage.upsertThirdPartyInfo(platform, userInfo)
            .then(ok => console.log('[base] DB update result:', ok))
            .catch(err => console.error('[base] DB background error:', err.message))
        );
      } catch (e) {
        // vercel/functions package might not be installed in all envs
      }
    }

    const response = createUserResponse(userInfo, platform);
    const result = response.get ? response.get() : response;

    console.log('[base] Returning response data:', JSON.stringify(result));
    
    return result;
  }

  getCompleteUrl(url = '') {
    const { SERVER_URL } = process.env;
    const protocol = this.ctx?.header?.['x-forwarded-proto'] || 'http';
    const host = this.ctx?.header?.['x-forwarded-host'] || this.ctx?.host || '';
    const baseUrl = SERVER_URL || `${protocol}://${host}`;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return baseUrl + cleanUrl;
  }

  async getUserInfo() {
    const code = this.ctx.params?.code || this.ctx.query?.code;
    const redirect = this.ctx.query?.redirect || this.ctx.params?.redirect;
    const state = this.ctx.query?.state || this.ctx.params?.state;

    if (!code) {
      return this.redirect();
    }

    /**
     * FIX: Distinguish between a Browser Redirect (Full URL) 
     * and a final UI Destination (Relative Path)
     */
    if (redirect && redirect.startsWith('http')) {
      try {
        const walineUrl = new URL(redirect);
        walineUrl.searchParams.set('code', code);
        if (state) walineUrl.searchParams.set('state', state);
        
        console.log('[OAuth Server] Browser phase: Redirecting to Waline:', walineUrl.toString());
        return this.ctx.redirect(walineUrl.toString());
      } catch (e) {
        console.error('[OAuth Server] Invalid redirect URL:', redirect);
      }
    }

    // If it's a relative path (like /ui/profile) or missing, 
    // we are in the background fetch phase. Proceed to get user data.
    this.ctx.type = 'json';
    try {
      const accessTokenInfo = await this.getAccessToken(code);
      const userInfo = await this.getUserInfoByToken(accessTokenInfo);
      
      return this.ctx.body = userInfo;
    } catch (error) {
      this.ctx.status = error.statusCode || 500;
      console.error('[base] Error in getUserInfo:', error.message);
      this.ctx.body = createErrorResponse(error.message, this.ctx.status).toJSON();
    }
  }
};