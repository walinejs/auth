/**
 * Unified OAuth Authentication Service - Integration Examples
 * 
 * This file contains practical examples for integrating
 * the OAuth authentication service with various backend frameworks
 */

// ==============================================================================
// Example 1: Express.js Integration
// ==============================================================================

const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60000 * 60 * 24 * 30 } // 30 days
}));

/**
 * Initiate OAuth login
 * GET /auth/login/github?redirect=<backendCallbackUrl>
 */
app.get('/auth/login/:provider', (req, res) => {
  const { provider } = req.params;
  const { redirect } = req.query;
  
  // Validate provider
  const validProviders = ['github', 'google', 'qq', 'facebook', 'weibo', 'twitter', 'oidc'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }
  
  // Generate state for CSRF protection
  const state = Math.random().toString(36).substring(7);
  req.session.oauth_state = state;
  
  // Store redirect URL
  if (redirect) {
    req.session.oauth_redirect = redirect;
  }
  
  // Redirect to OAuth authentication service
  const authUrl = new URL(`https://auth.example.com/${provider}`);
  authUrl.searchParams.set('redirect', `${process.env.SERVER_URL}/auth/callback/${provider}`);
  authUrl.searchParams.set('state', state);
  
  res.redirect(authUrl.toString());
});

/**
 * Handle OAuth callback
 * GET /auth/callback/github?code=<code>&state=<state>
 */
app.get('/auth/callback/:provider', async (req, res) => {
  const { provider } = req.params;
  const { code, state } = req.query;
  
  // Verify state for CSRF protection
  if (state !== req.session.oauth_state) {
    return res.status(400).json({ error: 'CSRF token mismatch' });
  }
  
  try {
    // Get user info from OAuth authentication service
    const authUrl = new URL(`https://auth.example.com/${provider}`);
    authUrl.searchParams.set('code', code);
    authUrl.searchParams.set('state', state);
    
    const authResponse = await fetch(authUrl.toString());
    const userData = await authResponse.json();
    
    // Handle auth service errors
    if (userData.errno) {
      return res.status(userData.errno).json(userData);
    }
    
    // userData structure:
    // {
    //   id: "platform-uuid",
    //   name: "Display Name",
    //   email: "user@example.com",
    //   url: "https://profile-url",
    //   avatar: "https://avatar-url",
    //   platform: "github"
    // }
    
    // Find or create user in your database
    const user = await User.findOrCreate({
      where: {
        [`${provider}_id`]: userData.id
      },
      defaults: {
        [`${provider}_id`]: userData.id,
        email: userData.email,
        name: userData.name,
        avatar: userData.avatar,
        provider: provider
      }
    });
    
    // Update user profile
    await user[0].update({
      email: userData.email || user[0].email,
      name: userData.name || user[0].name,
      avatar: userData.avatar || user[0].avatar,
      lastLogin: new Date()
    });
    
    // Create session
    req.session.userId = user[0].id;
    req.session.user = {
      id: user[0].id,
      name: user[0].name,
      avatar: user[0].avatar,
      email: user[0].email
    };
    
    // Redirect back to original URL or dashboard
    const redirectUrl = req.session.oauth_redirect || '/dashboard';
    delete req.session.oauth_redirect;
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

/**
 * Get current user
 * GET /auth/user
 */
app.get('/auth/user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json(req.session.user);
});

/**
 * Logout
 * POST /auth/logout
 */
app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// ==============================================================================
// Example 2: Frontend React Integration
// ==============================================================================

/*
import React, { useEffect, useState } from 'react';

function LoginComponent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/auth/user');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  }

  // Initiate OAuth login
  function handleOAuthLogin(provider) {
    const backendCallback = `${window.location.origin}/auth/callback/${provider}`;
    const authUrl = new URL(`https://auth.example.com/${provider}`);
    authUrl.searchParams.set('redirect', backendCallback);
    
    window.location.href = authUrl.toString();
  }

  // Logout
  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/auth/logout', { method: 'POST' });
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      setLoading(false);
    }
  }

  if (user) {
    return (
      <div className="user-profile">
        <img src={user.avatar} alt={user.name} />
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <button onClick={handleLogout} disabled={loading}>
          {loading ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    );
  }

  return (
    <div className="login-buttons">
      <button onClick={() => handleOAuthLogin('github')}>
        Login with GitHub
      </button>
      <button onClick={() => handleOAuthLogin('google')}>
        Login with Google
      </button>
      <button onClick={() => handleOAuthLogin('qq')}>
        Login with QQ
      </button>
      <button onClick={() => handleOAuthLogin('facebook')}>
        Login with Facebook
      </button>
      <button onClick={() => handleOAuthLogin('weibo')}>
        Login with Weibo
      </button>
      <button onClick={() => handleOAuthLogin('twitter')}>
        Login with Twitter
      </button>
    </div>
  );
}

export default LoginComponent;
*/

// ==============================================================================
// Example 3: Node.js Database Model (Sequelize)
// ==============================================================================

/*
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      sparse: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    avatar: {
      type: DataTypes.STRING
    },
    // OAuth IDs
    github_id: {
      type: DataTypes.STRING,
      unique: true,
      sparse: true
    },
    google_id: {
      type: DataTypes.STRING,
      unique: true,
      sparse: true
    },
    qq_id: {
      type: DataTypes.STRING,
      unique: true,
      sparse: true
    },
    facebook_id: {
      type: DataTypes.STRING,
      unique: true,
      sparse: true
    },
    weibo_id: {
      type: DataTypes.STRING,
      unique: true,
      sparse: true
    },
    twitter_id: {
      type: DataTypes.STRING,
      unique: true,
      sparse: true
    },
    oidc_id: {
      type: DataTypes.STRING,
      unique: true,
      sparse: true
    },
    // Metadata
    provider: {
      type: DataTypes.STRING,
      comment: 'Primary OAuth provider used for this account'
    },
    lastLogin: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  });

  return User;
};
*/

// ==============================================================================
// Example 4: API Client Utility
// ==============================================================================

/**
 * OAuth Authentication Service Client
 * Universal client for OAuth service integration
 */
class OAuthServiceClient {
  constructor(baseUrl = 'https://auth.example.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(provider, redirectUri, state = null) {
    const url = new URL(`${this.baseUrl}/${provider}`);
    url.searchParams.set('redirect', redirectUri);
    
    if (state) {
      url.searchParams.set('state', state);
    }
    
    return url.toString();
  }

  /**
   * Exchange authorization code for user info
   */
  async getUserInfo(provider, code, state = null) {
    const url = new URL(`${this.baseUrl}/${provider}`);
    url.searchParams.set('code', code);
    
    if (state) {
      url.searchParams.set('state', state);
    }
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`${error.errno}: ${error.message}`);
    }
    
    return await response.json();
  }

  /**
   * Check service availability
   */
  async getAvailableServices() {
    const response = await fetch(`${this.baseUrl}/`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch services');
    }
    
    return await response.json();
  }
}

// Usage:
// const client = new OAuthServiceClient('https://auth.example.com');
// const authUrl = client.getAuthorizationUrl('github', 'https://myapp.com/callback');
// const userInfo = await client.getUserInfo('github', code, state);

// ==============================================================================
// Example 5: Error Handling Middleware
// ==============================================================================

function handleOAuthError(error, res) {
  console.error('OAuth Error:', error);
  
  const errorMap = {
    'ETIMEDOUT': {
      errno: 503,
      message: 'OAuth service temporarily unavailable'
    },
    'ECONNREFUSED': {
      errno: 503,
      message: 'Cannot connect to authentication service'
    },
    'CSRF token mismatch': {
      errno: 400,
      message: 'Invalid security token. Please try logging in again.'
    },
    'Invalid provider': {
      errno: 400,
      message: 'Unsupported authentication provider'
    }
  };
  
  const errorKey = Object.keys(errorMap).find(key => 
    error.message.includes(key)
  );
  
  const errorResponse = errorMap[errorKey] || {
    errno: 500,
    message: 'An error occurred during authentication'
  };
  
  res.status(errorResponse.errno).json(errorResponse);
}

// ==============================================================================
// Example 6: Security Utilities
// ==============================================================================

/**
 * Generate secure random state token
 */
function generateState() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = '';
  for (let i = 0; i < 32; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return state;
}

/**
 * Validate OAuth response data
 */
function validateUserData(data) {
  const required = ['id', 'name'];
  const missing = required.filter(field => !data[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  if (typeof data.id !== 'string' || data.id.trim().length === 0) {
    throw new Error('Invalid user ID');
  }
  
  if (typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new Error('Invalid user name');
  }
  
  return true;
}

/**
 * Hash sensitive data for logging
 */
function hashForLogging(str) {
  if (!str) return 'N/A';
  return str.substring(0, 3) + '*'.repeat(str.length - 6) + str.substring(-3);
}

// Example logging:
// console.log(`User: ${userData.name}, ID: ${hashForLogging(userData.id)}`);

// ==============================================================================
// Example 7: Testing
// ==============================================================================

/*
const assert = require('assert');

describe('OAuth Integration', () => {
  describe('User Creation', () => {
    it('should create user from OAuth data', async () => {
      const oauthData = {
        id: 'github:12345',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        platform: 'github'
      };
      
      const user = await User.create({
        github_id: oauthData.id,
        name: oauthData.name,
        email: oauthData.email,
        avatar: oauthData.avatar,
        provider: 'github'
      });
      
      assert.strictEqual(user.name, 'Test User');
      assert.strictEqual(user.github_id, 'github:12345');
    });
  });

  describe('User Retrieval', () => {
    it('should find user by OAuth ID', async () => {
      const user = await User.findOne({
        where: { github_id: 'github:12345' }
      });
      
      assert(user);
      assert.strictEqual(user.name, 'Test User');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid state', async () => {
      const req = {
        query: { state: 'invalid' },
        session: { oauth_state: 'valid' }
      };
      
      assert.throws(() => {
        if (req.query.state !== req.session.oauth_state) {
          throw new Error('CSRF token mismatch');
        }
      });
    });
  });
});
*/

module.exports = {
  OAuthServiceClient,
  generateState,
  validateUserData,
  hashForLogging,
  handleOAuthError
};
