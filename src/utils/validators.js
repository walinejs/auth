/**
 * Validation utilities for OAuth user data
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID/ID format (non-empty string)
 * @param {string} id - ID to validate
 * @returns {boolean}
 */
function isValidId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * Sanitize user input - trim and remove null values
 * @param {Object} data - Data object
 * @returns {Object} Sanitized data
 */
function sanitizeUserData(data) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') {
      sanitized[key] = undefined;
    } else if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Extract avatar from various response formats
 * @param {any} picture - Picture data from OAuth provider
 * @returns {string|undefined} Avatar URL
 */
function extractAvatar(picture) {
  if (!picture) return undefined;
  
  // Handle string URLs
  if (typeof picture === 'string') {
    return picture.trim();
  }
  
  // Handle object with data property (like Facebook)
  if (typeof picture === 'object' && picture.data && picture.data.url) {
    return picture.data.url;
  }
  
  // Handle other object formats
  if (typeof picture === 'object' && picture.url) {
    return picture.url;
  }
  
  return undefined;
}

/**
 * Safe get nested property
 * @param {Object} obj - Object to query
 * @param {string} path - Path like 'a.b.c'
 * @param {any} defaultValue - Default if not found
 * @returns {any}
 */
function safeGet(obj, path, defaultValue = undefined) {
  try {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current !== undefined ? current : defaultValue;
  } catch {
    return defaultValue;
  }
}

module.exports = {
  isValidEmail,
  isValidUrl,
  isValidId,
  sanitizeUserData,
  extractAvatar,
  safeGet
};
