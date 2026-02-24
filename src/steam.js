const Base = require('./base');
const qs = require('querystring');
const request = require('request-promise-native');

const OPENID_CHECK_URL = 'https://steamcommunity.com/openid/login';
const PLAYER_SUMMARY_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

const { STEAM_KEY } = process.env;

module.exports = class extends Base {
  /**
   * Checks if the required Environment Variables are present.
   */
  static check() {
    return !!STEAM_KEY;
  }
  static info() {
    return { origin: new URL(PLAYER_SUMMARY_URL).hostname };
  }

  /**
   * Step 1: Redirect the user to Steam's OpenID login page.
   */
  async redirect() {
    // 1. Get the parameters sent by Waline
    const fullRedirect = this.ctx.query?.redirect || this.ctx.params?.redirect;
    const state = this.ctx.query?.state || this.ctx.params?.state;

    // If visiting directly (no redirect param), show a status JSON instead of 400 error
    if (!fullRedirect) {
      this.ctx.type = 'json';
      this.ctx.body = {
        status: 'online',
        service: 'Steam OpenID Adapter',
        message: 'This endpoint is for Waline authentication. Please initiate login from your Waline comment area.'
      };
      return;
    }

    // 2. IMPORTANT: Extract the REAL final destination (e.g., /ui/profile)
    // Waline sends a URL like: https://.../api/oauth?redirect=/ui/profile&type=steam
    // We need to find that inner "redirect" value.
    const urlObj = new URL(fullRedirect);
    const finalDestination = urlObj.searchParams.get('redirect') || '/';
    const walineCallbackBase = `${urlObj.origin}${urlObj.pathname}`;

    // 3. Build the return_to URL
    // We want Waline to receive the callback, but then redirect to the UI
    const returnUrlParams = qs.stringify({
      type: 'steam',
      redirect: finalDestination, // Now just "/ui/profile"
      state: state
    });
    const returnUrl = `${walineCallbackBase}?${returnUrlParams}`;

    const params = {
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnUrl,
      'openid.realm': urlObj.origin,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    };

    return this.ctx.redirect(OPENID_CHECK_URL + '?' + qs.stringify(params));
  }

  /**
   * Step 2: Verify the OpenID assertion.
   * Steam doesn't provide a 'code' to exchange for a token. 
   * Instead, we validate the query parameters sent back by Steam.
   */
  async getAccessToken() {
    const queryParams = this.ctx.query || this.ctx.params;
    const params = {
      ...queryParams,
      'openid.mode': 'check_authentication',
    };

    console.log('[Steam] Verifying with Steam API...');
    const response = await request.post({
      url: OPENID_CHECK_URL,
      form: params,
    });

    if (!response.includes('is_valid:true')) {
      console.error('[Steam] Verification failed. Steam returned:', response);
      throw new Error('Steam OpenID verification failed');
    }

    const steamId = params['openid.claimed_id'].split('/').pop();
    console.log('[Steam] Verified SteamID:', steamId);
    return { steamId };
  }

  /**
   * Step 3: Fetch the user's profile information using their Steam ID.
   */
  async getUserInfoByToken({ steamId }) {
    const data = await request.get({
      url: PLAYER_SUMMARY_URL,
      qs: {
        key: STEAM_KEY,
        steamids: steamId,
      },
      json: true,
    });

    const player = data.response.players[0];

    if (!player) {
      throw new Error('Failed to fetch Steam user profile');
    }

    // Map Steam fields to Waline user format
    return await this.formatUserResponse({
      id: player.steamid,
      name: player.personaname,
      email: `${player.steamid}@steam-uuid.com`, // Steam OpenID does not provide email addresses
      url: player.profileurl,
      avatar: player.avatarfull,
      originalResponse: player
    }, 'steam');
  }
};