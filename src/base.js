/**
 * base.js
 * Waline OAuth Base Provider with DB storage and debug
 */

import { saveUserToDB } from './db.js';

console.log('[storage/base] module loaded');

function debug(...args) {
  console.log('[storage/base]', ...args);
}

function debugError(...args) {
  console.error('[storage/base ERROR]', ...args);
}

/**
 * Base provider class
 * Waline providers extend this class
 */
export default class BaseProvider {

  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;

    debug('BaseProvider constructed');
  }

  /**
   * Called by provider after getting user info
   */
  async storeUser(user) {

    debug('storeUser called');
    debug('User:', JSON.stringify(user, null, 2));

    try {

      const dbResult = await saveUserToDB(user);

      debug('DB save success:', dbResult);

      return {
        ...user,
        dbStored: true
      };

    } catch (err) {

      debugError('DB save failed:', err.message);

      return {
        ...user,
        dbStored: false
      };
    }
  }

}