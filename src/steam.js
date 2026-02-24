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
    const { redirect, state } = this.ctx.params;
    
    // We add code=steam so that base.js's getUserInfo() passes the !code check
    // when Steam redirects the user back to our server.
    const returnUrl = this.getCompleteUrl('/steam') + '?' + qs.stringify({ redirect, state, code: 'steam' });

    const params = {
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnUrl,
      'openid.realm': this.getCompleteUrl(''),
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    };

    const url = OPENID_CHECK_URL + '?' + qs.stringify(params);
    return this.ctx.redirect(url);
  }

  /**
   * Step 2: Verify the OpenID assertion.
   * Steam doesn't provide a 'code' to exchange for a token. 
   * Instead, we validate the query parameters sent back by Steam.
   */
  async getAccessToken() {
    // Ensure we are using all parameters forwarded from Waline
    const queryParams = this.ctx.query || this.ctx.params;

    const params = {
      ...queryParams,
      'openid.mode': 'check_authentication',
    };

    const response = await request.post({
      url: OPENID_CHECK_URL,
      form: params,
    });

    if (!response.includes('is_valid:true')) {
      console.error('[Steam] Verification failed. Steam returned:', response);
      throw new Error('Steam OpenID verification failed');
    }

    const steamId = params['openid.claimed_id'].split('/').pop();
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