# Unified OAuth Authentication Service

## Table of Contents
1. [Project Overview](#project-overview)
2. [Unified Response Format](#unified-response-format)
3. [Installation & Deployment](#installation--deployment)
4. [Environment Variables Setup](#environment-variables-setup)
5. [Platform-Specific Configuration](#platform-specific-configuration)
6. [API Endpoints & Usage](#api-endpoints--usage)
7. [Response Examples](#response-examples)
8. [Error Handling](#error-handling)
9. [Utility Functions](#utility-functions)
10. [Best Practices](#best-practices)

---

## Project Overview

This is a unified OAuth authentication service that supports multiple third-party platforms. It can be used with [Waline](https://waline.js.org) comment systems or integrated into any web application:
- GitHub
- Google
- Facebook
- Weibo
- QQ
- Twitter
- OpenID Connect (OIDC)

### Key Features

✅ **Unified Response Format** - All OAuth providers return a consistent JSON structure
✅ **Data Validation & Sanitization** - User data is validated and normalized automatically
✅ **Error Handling** - Comprehensive error responses with standardized error codes
✅ **Vercel Deployment Ready** - Built for serverless deployment on Vercel
✅ **Flexible Integration** - Works with Waline, static sites, SPAs, backend services, and more

### Architecture

```
┌─────────────────────────────────────────────────┐
│        Client Application/Browser              │
│        (e.g., Waline, Static Site, SPA)        │
└────────────────┬────────────────────────────────┘
                 │
                 │ OAuth Flow
                 │
┌────────────────▼────────────────────────────────┐
│       OAuth Authentication Service (This Project)        │
│  ┌──────────────────────────────────────────┐  │
│  │  Unified Response Formatter              │  │
│  │  - Normalize user data                   │  │
│  │  - Validate required fields              │  │
│  │  - Format consistent responses           │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Platform-Specific Handlers               │  │
│  │  - GitHub  - Google  - QQ                 │  │
│  │  - Facebook - Weibo  - Twitter - OIDC     │  │
│  └──────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────┘
                 │
                 │ API Requests
                 │
       ┌─────────┴─────────┐
       │                   │
   ┌───▼───┐          ┌────▼────┐
   │OAuth  │          │ User    │
   │Server │          │ Info    │
   │       │          │ Endpoint│
   └───────┘          └─────────┘
```

---

## Unified Response Format

### Standard User Response

All OAuth providers return user information in this **unified JSON format**:

```json
{
  "id": "string",           // Platform UUID (Required) - Unique identifier from OAuth provider
  "name": "string",         // Username (Required) - User's display name
  "email": "string|null",   // Email address (Optional) - Email associated with account
  "url": "string|null",     // Profile URL (Optional) - Link to user's profile page
  "avatar": "string|null",  // Avatar URL (Optional) - User's profile picture
  "platform": "string"      // Platform name - 'github', 'google', 'qq', etc.
}
```

### Response Fields Explanation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ Yes | Unique identifier from the OAuth provider (platform UUID) |
| `name` | string | ✅ Yes | User's display name or username |
| `email` | string\|null | ❌ No | User's email address, omitted if not available |
| `url` | string\|null | ❌ No | Link to user's profile, omitted if not available |
| `avatar` | string\|null | ❌ No | URL to user's profile picture, omitted if not available |
| `platform` | string | ❌ No | Name of the OAuth platform |

### Error Response Format

Failed requests return a standardized error response:

```json
{
  "errno": 400,                // HTTP status code
  "message": "Error message"   // Descriptive error message
}
```

---

## Installation & Deployment

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/walinejs/auth.git
cd auth

# 2. Install dependencies
npm install

# 3. Create .env.local file with your configuration
# See "Environment Variables Setup" section below

# 4. Start development server
npm start
# Server runs at http://localhost:3000
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/walinejs/auth)

**One-click deployment steps:**
1. Click the deploy button above
2. Connect your GitHub account
3. Set environment variables in Vercel dashboard
4. Deploy

**Manual deployment:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel
```

---

## Environment Variables Setup

### General Configuration

```env
# (Optional) Server base URL for development
# If not set, automatically detected from request headers
SERVER_URL=https://your-auth-server.vercel.app
```

### GitHub OAuth

**Create Application:** https://github.com/settings/oauth-apps

```env
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret
```

**Redirect URI in GitHub Settings:**
```
https://your-server/github
```

### Google OAuth

**Create Project:** https://console.cloud.google.com/

```env
GOOGLE_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_SECRET=your_google_client_secret
```

**Redirect URI in Google Console:**
```
https://your-server/google
```

### QQ OAuth

**Create Application:** https://connect.qq.com/

```env
QQ_ID=your_qq_app_id
QQ_SECRET=your_qq_app_secret
```

### Facebook OAuth

**Create App:** https://developers.facebook.com/

```env
FACEBOOK_ID=your_facebook_app_id
FACEBOOK_SECRET=your_facebook_app_secret
```

**Redirect URI in Facebook Settings:**
```
https://your-server/facebook
```

### Weibo OAuth

**Create Application:** https://open.weibo.com/

```env
WEIBO_ID=your_weibo_app_id
WEIBO_SECRET=your_weibo_app_secret
```

### Twitter OAuth 2.0

**Create App:** https://developer.twitter.com/

```env
TWITTER_ID=your_twitter_client_id
TWITTER_SECRET=your_twitter_client_secret
```

### OpenID Connect (OIDC)

**Option 1: Using Issuer Discovery**
```env
OIDC_ID=your_oidc_client_id
OIDC_SECRET=your_oidc_client_secret
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_SCOPES=openid profile email
```

**Option 2: Using Explicit Endpoints**
```env
OIDC_ID=your_oidc_client_id
OIDC_SECRET=your_oidc_client_secret
OIDC_AUTH_URL=https://your-oidc-provider.com/oauth/authorize
OIDC_TOKEN_URL=https://your-oidc-provider.com/oauth/token
OIDC_USERINFO_URL=https://your-oidc-provider.com/oauth/userinfo
OIDC_SCOPES=openid profile email
```

### Example .env.local

```env
SERVER_URL=https://auth.example.com

GITHUB_ID=abc123
GITHUB_SECRET=xyz789

GOOGLE_ID=123.apps.googleusercontent.com
GOOGLE_SECRET=secret456

QQ_ID=1234567890
QQ_SECRET=qqsecret

FACEBOOK_ID=fb123
FACEBOOK_SECRET=fbsecret

WEIBO_ID=weibo123
WEIBO_SECRET=weibo_secret

TWITTER_ID=twitter123
TWITTER_SECRET=twitter_secret

OIDC_ID=oidc123
OIDC_SECRET=oidc_secret
OIDC_ISSUER=https://acme.auth0.com
```

---

## Platform-Specific Configuration

### GitHub

**Prerequisites:**
- GitHub account
- Create OAuth App in account settings

**Steps:**
1. Go to https://github.com/settings/developers
2. Click "OAuth Apps" → "New OAuth App"
3. Fill in application details:
   - Application name: "My App"
   - Homepage URL: `https://example.com`
   - Authorization callback URL: `https://your-server/github`
4. Copy Client ID and Client Secret
5. Set environment variables: `GITHUB_ID` and `GITHUB_SECRET`

**Scopes Requested:** `read:user,user:email`

**Returned Data:**
- `id`: GitHub username
- `name`: User's display name
- `email`: Primary email address
- `avatar`: Avatar URL
- `url`: Blog URL or profile page

---

### Google

**Prerequisites:**
- Google Cloud Project
- OAuth 2.0 Credentials

**Steps:**
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials (Web Application)
5. Add redirect URI: `https://your-server/google`
6. Copy Client ID and Client Secret
7. Set environment variables: `GOOGLE_ID` and `GOOGLE_SECRET`

**Scopes Requested:**
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/userinfo.email`

**Returned Data:**
- `id`: Google user ID
- `name`: User's full name
- `email`: Email address
- `avatar`: Profile picture URL

---

### QQ

**Prerequisites:**
- QQ account
- QQ Connect application

**Steps:**
1. Go to https://connect.qq.com/
2. Create a new QQ Connect application
3. Upload application information
4. Add redirect URI: `https://your-server/qq`
5. Get app ID and secret
6. Set environment variables: `QQ_ID` and `QQ_SECRET`

**Returned Data:**
- `id`: QQ Union ID
- `name`: QQ nickname
- `email`: Email (if available) or auto-generated
- `avatar`: Profile picture (multiple resolution options)

---

### Facebook

**Prerequisites:**
- Facebook account
- Facebook App

**Steps:**
1. Go to https://developers.facebook.com/
2. Create a new app
3. Add "Facebook Login" product
4. Configure OAuth redirect URIs: `https://your-server/facebook`
5. Copy App ID and App Secret
6. Set environment variables: `FACEBOOK_ID` and `FACEBOOK_SECRET`

**Scopes Requested:** `email`

**Returned Data:**
- `id`: Facebook user ID
- `name`: User's name
- `email`: Email address
- `avatar`: Profile picture
- `url`: Facebook profile link

---

### Weibo

**Prerequisites:**
- Weibo account
- Weibo Open Platform application

**Steps:**
1. Go to https://open.weibo.com/
2. Create a new Weibo developer app
3. Add website application
4. Configure OAuth redirect: `https://your-server/weibo`
5. Get App Secret and Secret
6. Set environment variables: `WEIBO_ID` and `WEIBO_SECRET`

**Returned Data:**
- `id`: Weibo user ID string
- `name`: Weibo screen name
- `avatar`: User avatar (high resolution)
- `url`: Weibo profile URL

---

### Twitter

**Prerequisites:**
- Twitter account
- Twitter Developer Account

**Steps:**
1. Go to https://developer.twitter.com/
2. Create/access an app
3. Generate API credentials
4. Add OAuth 2.0 redirect URI: `https://your-server/twitter`
5. Copy Client ID and Client Secret
6. Set environment variables: `TWITTER_ID` and `TWITTER_SECRET`

**Scopes Requested:**
- `tweet.read`
- `users.read`
- `offline.access`
- `email` (if available)

**Returned Data:**
- `id`: Twitter user ID
- `name`: User's display name
- `email`: Email (if authorized)
- `avatar`: Profile image URL
- `url`: Twitter profile URL

---

### OpenID Connect (OIDC)

OIDC is a flexible authentication protocol. Examples include:
- Auth0 (https://auth0.com/)
- Keycloak (https://www.keycloak.org/)
- Microsoft Entra ID
- Okta
- Others

**Steps:**
1. Create OIDC application in your provider
2. Configure redirect URI: `https://your-server/oidc`
3. Get Client ID and Secret
4. Either:
   - Set `OIDC_ISSUER` (auto-discover endpoints), OR
   - Set explicit endpoints: `OIDC_AUTH_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL`
5. Optionally customize scopes with `OIDC_SCOPES`

**Returned Data:**
- `id`: OIDC subject claim (sub)
- `name`: User's name or username
- `email`: Email address
- `avatar`: Profile picture
- `url`: Profile URL or website

---

## API Endpoints & Usage

### Root Endpoint

**GET** `/`

Returns information about available OAuth services.

**Response:**
```json
{
  "version": "1.1.0",
  "services": [
    {
      "name": "github",
      "origin": "github.com"
    },
    {
      "name": "google",
      "origin": "accounts.google.com"
    }
  ]
}
```

---

### OAuth Login Flow - Step 1: Redirect to OAuth Provider

**GET** `/{platform}?redirect={redirectUrl}&state={customState}`

Redirects user to the OAuth provider's login page.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | string | ✅ Yes | OAuth provider name: `github`, `google`, `qq`, `facebook`, `weibo`, `twitter`, `oidc` |
| `redirect` | string | ✅ Yes | Your application's callback URL after authentication |
| `state` | string | ❌ No | Custom state value for CSRF protection |

**Example Request:**
```
GET /github?redirect=https://example.com/auth/callback&state=abc123
```

**User Flow:**
1. User clicks "Login with GitHub"
2. Browser redirected to GitHub login page
3. User authorizes your application
4. GitHub redirects back to this service with OAuth code

---

### OAuth Login Flow - Step 2: Get User Information

**GET** `/{platform}?code={oauthCode}&state={customState}`

Exchanges OAuth code for user information.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `platform` | string | ✅ Yes | OAuth provider name |
| `code` | string | ✅ Yes | Authorization code from OAuth provider |
| `state` | string | ❌ No | Original state value for verification |

**Response:** [See Response Examples section](#response-examples)

**Example cURL:**
```bash
curl -X GET "https://auth.example.com/github?code=abc123def456&state=xyz789"
```

**Example JavaScript:**
```javascript
// After OAuth provider redirects with code
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const state = params.get('state');

const response = await fetch(`/github?code=${code}&state=${state}`);
const userData = await response.json();
console.log(userData);
```

---

### Complete OAuth Flow Example

#### 1. Frontend: Initiate Login
```html
<a href="https://auth.example.com/github?
  redirect=https://example.com/auth/callback
  &state=abc123">
  Login with GitHub
</a>
```

#### 2. Backend: Handle Callback
```javascript
// User is redirected with code
// POST from frontend to backend
app.post('/auth/callback', async (req, res) => {
  const { code, state } = req.body;
  
  Fetch user info from OAuth service
  const response = await fetch(
    `https://auth.example.com/github?code=${code}&state=${state}`,
    {
      headers: { 'User-Agent': 'MyApp/1.0' } // Identify backend service
    }
  );
  
  const userData = await response.json();
  
  // userData contains:
  // { id, name, email, url, avatar, platform }
  
  // Create user in your system
  const user = await createOrUpdateUser(userData);
  
  // Set session/JWT
  req.session.user = user;
  
  res.json({ success: true, user });
});
```

#### 3. Frontend: Save Authentication
```javascript
const loginButton = document.querySelector('.login-btn');
loginButton.addEventListener('click', async () => {
  const baseUrl = 'https://auth.example.com/github';
  const redirectUrl = `${window.location.origin}/auth/callback`;
  
  // Redirect to OAuth service
  window.location.href = 
    `${baseUrl}?redirect=${encodeURIComponent(redirectUrl)}&state=${generateState()}`;
});

function generateState() {
  return Math.random().toString(36).substring(7);
}
```

---

## Response Examples

### Successful GitHub Authentication

**Request:**
```
GET /github?code=gho_16C7e42F292c6912E7710c838347Ae178B4a&state=abc123
```

**Response:**
```json
{
  "id": "octocat",
  "name": "The Octocat",
  "email": "octocat@github.com",
  "url": "https://github.blog",
  "avatar": "https://avatars.githubusercontent.com/u/1?v=4",
  "platform": "github"
}
```

---

### Successful Google Authentication

**Request:**
```
GET /google?code=4/0AX4XfWheWJ...&state=xyz789
```

**Response:**
```json
{
  "id": "117281334449806500000",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "avatar": "https://lh3.googleusercontent.com/a/...",
  "platform": "google"
}
```

---

### Successful QQ Authentication

**Request:**
```
GET /qq?code=0045F8D03...&state=123456
```

**Response:**
```json
{
  "id": "F94AB2F8DACD32E0CDCD39ADCC4E01B4",
  "name": "小Q",
  "avatar": "https://q4.qlogo.cn/headimg_dl?dst_uin=...",
  "platform": "qq"
}
```

---

### Successful Facebook Authentication

**Request:**
```
GET /facebook?code=EAABsZCISLtIBACP...&state=zyx987
```

**Response:**
```json
{
  "id": "1234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "url": "https://www.facebook.com/john.doe",
  "avatar": "https://platform-lookaside.fbsbx.com/...",
  "platform": "facebook"
}
```

---

### Authentication Error

**Request:**
```
GET /github?error=access_denied&error_description=The+user+denied+access
```

**Response:**
```json
{
  "errno": 401,
  "message": "[GitHub OAuth Error] access_denied - The user denied access"
}
```

---

## Error Handling

### Standard Error Response Format

All errors return a consistent JSON structure:

```json
{
  "errno": 400,              // HTTP status code
  "message": "Error message" // Detailed error description
}
```

### Common Error Codes

| Code | Scenario | Example |
|------|----------|---------|
| `400` | Invalid request parameters | Missing required `code` parameter |
| `401` | Authentication failed | Invalid OAuth code or token expired |
| `403` | Forbidden | User denied access or scopes insufficient |
| `404` | Not found | OAuth platform endpoint unreachable |
| `500` | Server error | Internal API error or data validation failed |

### Error Handling Best Practices

```javascript
// Frontend error handling
async function authenticateWithGitHub(code) {
  try {
    const response = await fetch(`/github?code=${code}`);
    const data = await response.json();
    
    if (!response.ok) {
      // Handle error response
      console.error(`Error ${data.errno}: ${data.message}`);
      
      switch (data.errno) {
        case 401:
          showErrorMessage('Authentication failed. Please try again.');
          break;
        case 403:
          showErrorMessage('You denied access. Please authorize the app.');
          break;
        default:
          showErrorMessage('An error occurred. Please try again later.');
      }
      return null;
    }
    
    // Handle success
    return data;
  } catch (error) {
    console.error('Network error:', error);
    showErrorMessage('Network error. Please check your connection.');
  }
}
```

### Debugging Tips

**Enable Vercel logs:**
```bash
vercel logs --follow
```

**Check environment variables:**
```bash
vercel env list
```

**Test locally:**
```bash
npm run start
# Visit http://localhost:3000 to see available services
```

---

## Utility Functions

### Response Utilities

#### `createUserResponse(rawData, platform)`

Creates a validated user response object.

```javascript
const { createUserResponse } = require('./src/utils');

const userResponse = createUserResponse({
  id: 'github-username',
  name: 'User Name',
  email: 'user@example.com',
  avatar: 'https://...'
}, 'github');

const normalizedData = userResponse.get();
```

#### `UserResponse` Class

```javascript
const { UserResponse } = require('./src/utils');

const response = new UserResponse()
  .setId('user-id')
  .setName('Display Name')
  .setEmail('user@example.com')
  .setAvatar('https://...')
  .setPlatform('github');

const data = response.get();
```

---

### Validation Utilities

#### `sanitizeUserData(data)`

Removes null values and trims strings.

```javascript
const { sanitizeUserData } = require('./src/utils');

const dirty = {
  name: '  John Doe  ',
  email: '',
  url: null
};

const clean = sanitizeUserData(dirty);
// Result: { name: 'John Doe', email: undefined, url: undefined }
```

#### `isValidEmail(email)`

Validates email format.

```javascript
const { isValidEmail } = require('./src/utils');

isValidEmail('user@example.com');  // true
isValidEmail('invalid-email');     // false
```

#### `extractAvatar(picture)`

Safely extracts avatar URL from various formats.

```javascript
const { extractAvatar } = require('./src/utils');

// Handles string
extractAvatar('https://example.com/avatar.jpg');

// Handles nested object (Facebook style)
extractAvatar({ data: { url: 'https://...' } });

// Returns undefined if not found
extractAvatar(null);
```

---

## Best Practices

### 1. Security

✅ **Always validate OAuth codes server-side**
```javascript
// Good: Validate in backend
const userData = await validateOAuthCode(code);

// Bad: Trust client-provided user ID
const userId = req.body.userId; // Don't do this!
```

✅ **Use HTTPS in production**
```env
# OAuth providers require HTTPS
SERVER_URL=https://your-domain.com
```

✅ **Protect client secrets**
```javascript
// Good: Use environment variables
const secret = process.env.GITHUB_SECRET;

// Bad: Hardcode secrets
const secret = 'abc123secret'; // Never!
```

✅ **Validate state parameter for CSRF protection**
```javascript
// When Initiating login
const state = generateRandomString();
sessionStorage.state = state;

// When handling callback
if (req.query.state !== sessionStorage.state) {
  throw new Error('CSRF violation');
}
```

---

### 2. User Data Handling

✅ **Store platform UUID, not email, as primary key**
```javascript
// Good: Use 'id' as primary key
const user = await db.users.findById(userData.id);

// Less reliable: Using email as primary key
const user = await db.users.findByEmail(userData.email);
```

✅ **Normalize user names**
```javascript
// Platform may return different formats
const name = userData.name || userData.username || 'User';
```

✅ **Handle missing optional fields gracefully**
```javascript
// Email might not be available
const email = userData.email || `${userData.id}@${userData.platform}.local`;
```

---

### 3. Error Handling

✅ **Catch and log OAuth errors**
```javascript
try {
  const userData = await getOAuthUserInfo(code);
} catch (error) {
  logger.error('OAuth error:', error);
  res.status(500).json({
    errno: 500,
    message: 'Authentication service unavailable'
  });
}
```

✅ **Provide user-friendly error messages**
```javascript
// Good
message: "Login failed. Please try again or use another method."

// Bad
message: "Token refresh error: ETIMEDOUT"
```

---

### 4. Performance

✅ **Cache discovery endpoints for OIDC**
```javascript
// Good: Cache OIDC discovery
const discovery = await cache.get('oidc:discovery') 
  || await fetchDiscovery();

// Bad: Fetch on every request
const discovery = await fetchDiscovery();
```

✅ **Reuse HTTP connections**
```javascript
// request-promise-native reuses connections
```

---

### 5. Testing

✅ **Test OAuth flow locally**
```bash
npm start
# Visit http://localhost:3000
# Click provider links to test PKCE flow
```

✅ **Use OAuth test credentials**
```env
# Create test apps on each platform
# Do not use production credentials for testing
```

✅ **Mock OAuth responses in tests**
```javascript
jest.mock('request-promise-native');

test('GitHub auth', async () => {
  request.get.mockResolvedValue({
    login: 'testuser',
    name: 'Test User'
  });
  
  const result = await github.getUserInfoByToken({ access_token: 'test' });
  expect(result.id).toBe('testuser');
});
```

---

## Troubleshooting

### "Service not available" error

**Cause:** Environment variables not set

**Solution:**
```bash
# Check Vercel environment variables
vercel env list

# Set missing variables
vercel env add GITHUB_ID your_id
vercel env add GITHUB_SECRET your_secret
```

### OAuth redirect URI mismatch

**Cause:** Redirect URL doesn't match OAuth app configuration

**Solution:**
```
1. Check your OAuth app settings on provider dashboard
2. Ensure redirect URL matches exactly: https://your-domain/github
3. Note: http:// works locally, https:// required in production
```

### PKCE verification failed (Twitter)

**Cause:** State parameter was corrupted or invalid

**Solution:**
```
1. Verify that the complete state parameter is being passed between callback steps
2. Check URL encoding - ensure state parameter is properly encoded/decoded
3. Verify TWITTER_ID and TWITTER_SECRET are set correctly
4. Try the authentication flow again
```

### Missing required user data

**Cause:** OAuth provider didn't return expected fields

**Solution:**
```javascript
// Provide fallback values
const user = {
  id: userData.id, // Always present
  name: userData.name || 'User',
  email: userData.email || `${userData.id}@${platform}.local`,
  avatar: userData.avatar || null
};
```

---

## Integration Examples

### Waline Comment System

```javascript
// In your Waline configuration
const walineConfig = {
  el: '#waline',
  serverURL: 'https://your-waline-api.com',
  login: 'enable', // or 'force'
  oauth: {
    github: {
      clientId: 'YOUR_GITHUB_ID',
      clientSecret: 'YOUR_GITHUB_SECRET'
    },
    google: {
      clientId: 'YOUR_GOOGLE_ID',
      clientSecret: 'YOUR_GOOGLE_SECRET'
    }
  }
};
```

### Node.js/Express Backend Integration

```javascript
// Backend route for universal OAuth handling
app.get('/api/auth/callback/:provider', async (req, res) => {
  const { provider } = req.params;
  const { code, state } = req.query;
  
  // Get user from OAuth service
  const userData = await fetch(
    `https://auth.example.com/${provider}?code=${code}&state=${state}`
  ).then(r => r.json());
  
  if (userData.errno) {
    return res.status(userData.errno).json(userData);
  }
  
  // Create/update user in your database
  const user = await User.upsert({
    [`${provider}_id`]: userData.id,
    email: userData.email,
    name: userData.name,
    avatar: userData.avatar
  });
  
  // Create session/JWT
  req.session.userId = user.id;
  res.redirect('/dashboard');
});
```

---

## Support & Contributing

- **Issues:** https://github.com/walinejs/auth/issues
- **Discussions:** https://github.com/walinejs/auth/discussions
- **Contributing:** See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## License

MIT © 2024 Waline Contributors

---

## Version History

### v1.2.0 (Current)
- ✨ Unified response formatter
- ✨ Enhanced error handling
- ✨ Comprehensive validation utilities
- 🔧 Improved platform normalization
- 📚 Complete technical documentation

### v1.1.0
- Initial multi-platform support
- Basic OAuth flow for 7 providers

---

**Last Updated:** 2024 | For the latest version, visit: https://github.com/walinejs/auth
