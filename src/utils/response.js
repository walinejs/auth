/**
 * Unified Response Formatter
 * Standardizes user data from all OAuth providers
 */

class UserResponse {
  constructor(data = {}) {
    this.data = {
      id: '',
      name: '',
      email: '',
      url: '',
      avatar: '',
      platform: '',
      ...data
    };
  }

  /**
   * Validate and normalize user data
   * @returns {Object} Normalized user data
   */
  validate() {
    const errors = [];

    // Platform UUID is required
    if (!this.data.id || typeof this.data.id !== 'string') {
      errors.push('Missing or invalid platform UUID (id)');
    }

    // Username is required
    if (!this.data.name || typeof this.data.name !== 'string') {
      errors.push('Missing or invalid username (name)');
    }

    if (errors.length > 0) {
      const error = new Error('User data validation failed: ' + errors.join(', '));
      error.validated = false;
      error.statusCode = 400;
      throw error;
    }

    return this.normalize();
  }

  /**
   * Normalize user data to ensure consistency
   * @returns {Object} Normalized data
   */
  normalize() {
    return {
      ...this.data,
      id: String(this.data.id).trim(),
      name: String(this.data.name).trim(),
      email: String(this.data.email || '').trim() || undefined,
      url: String(this.data.url || '').trim() || undefined,
      avatar: String(this.data.avatar || '').trim() || undefined,
      platform: String(this.data.platform || '').trim() || undefined
    };
  }

  /**
   * Set user ID (platform UUID)
   */
  setId(id) {
    this.data.id = id;
    return this;
  }

  /**
   * Set username
   */
  setName(name) {
    this.data.name = name;
    return this;
  }

  /**
   * Set email
   */
  setEmail(email) {
    this.data.email = email;
    return this;
  }

  /**
   * Set profile URL
   */
  setUrl(url) {
    this.data.url = url;
    return this;
  }

  /**
   * Set avatar URL
   */
  setAvatar(avatar) {
    this.data.avatar = avatar;
    return this;
  }

  /**
   * Set platform name
   */
  setPlatform(platform) {
    this.data.platform = platform;
    return this;
  }

  /**
   * Get final response data
   */
  get() {
    return this.validate();
  }
}

/**
 * Create a unified response from OAuth provider data
 * @param {Object} rawData - Raw user data from OAuth provider
 * @param {string} platform - Platform name (github, google, qq, etc.)
 * @returns {UserResponse} Unified response object
 */
function createUserResponse(rawData = {}, platform = '') {
  return new UserResponse({
    ...rawData,
    platform
  });
}

/**
 * Error response builder
 */
class ErrorResponse {
  constructor(message, code = 500) {
    this.message = message;
    this.code = code;
  }

  toJSON() {
    return {
      errno: this.code,
      message: this.message
    };
  }
}

/**
 * Create error response
 */
function createErrorResponse(message, code = 500) {
  return new ErrorResponse(message, code);
}

module.exports = {
  UserResponse,
  createUserResponse,
  ErrorResponse,
  createErrorResponse
};
