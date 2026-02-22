/**
 * base.js
 * Waline OAuth base handler with optional database storage
 */

import { saveUserToDB } from './db.js';

/**
 * Debug logger
 */
function debug(...args) {
  console.log('[OAuth Base]', ...args);
}

/**
 * Error logger
 */
function debugError(...args) {
  console.error('[OAuth Base ERROR]', ...args);
}

/**
 * Main handler
 * This MUST be exported
 */
export async function handleOAuthUser(userData, context = {}) {
  debug('handleOAuthUser called');
  debug('Incoming userData:', JSON.stringify(userData, null, 2));

  let dbResult = null;
  let dbSuccess = false;

  try {
    debug('Attempting DB save...');

    dbResult = await saveUserToDB(userData);

    dbSuccess = true;

    debug('DB save success:', dbResult);
  } catch (err) {
    dbSuccess = false;

    debugError('DB save failed:', err?.message);
    debugError(err?.stack);
  }

  /**
   * ALWAYS return user object
   * Waline must continue even if DB fails
   */
  const result = {
    ...userData,

    meta: {
      dbStored: dbSuccess,
      dbResult: dbResult ?? null,
      timestamp: new Date().toISOString()
    }
  };

  debug('Returning user:', JSON.stringify(result, null, 2));

  return result;
}