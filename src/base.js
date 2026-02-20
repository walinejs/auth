const qs = require('querystring');
const { createErrorResponse, createUserResponse } = require('./utils');

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
   * @param {Object} userInfo - User information object
   * @param {string} platform - Platform name
   * @returns {Object} Formatted user response
   */
  formatUserResponse(userInfo, platform = '') {
    try {
      const response = createUserResponse(userInfo, platform);
      return response.get();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handler for getUserInfo - fetch access token and user info
   */
  async getUserInfo() {
    const {code, redirect, state} = this.ctx.params;
    if(!code) {
      return this.redirect();
    }

    if(redirect) {
      return this.ctx.redirect(redirect + (redirect.includes('?') ? '&' : '?') + qs.stringify({ code, state }));
    }

    this.ctx.type = 'json';
    try {
      const accessTokenInfo = await this.getAccessToken(code);
      const userInfo = await this.getUserInfoByToken(accessTokenInfo);
      return this.ctx.body = userInfo;
    } catch (error) {
      this.ctx.status = error.statusCode || 500;
      this.ctx.body = createErrorResponse(error.message, this.ctx.status).toJSON();
    }
  }
};
