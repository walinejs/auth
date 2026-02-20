# OAuth Center

A unified OAuth authentication service that supports [GitHub][GitHub], [Twitter][Twitter], [Facebook][Facebook], [Google][Google], [Weibo][Weibo], [QQ][QQ], and [OpenID Connect (OIDC)][OIDC]. Perfect for [Waline](https://waline.js.org) comment systems, or integrate with any web application.

## ✨ Key Features

- 🔐 **Multi-Platform OAuth Support** - GitHub, Google, QQ, Facebook, Weibo, Twitter, OIDC
- 🎯 **Unified Response Format** - All platforms return consistent JSON structure
- ✅ **Data Validation & Normalization** - Automatic user data validation
- 🚀 **Serverless Ready** - Deploy instantly to Vercel
- 📚 **Comprehensive Documentation** - Full technical guide included

## Unified Response Format

All OAuth providers return user information in a standardized format:

```json
{
  "id": "platform-uuid",        // Unique identifier from OAuth provider
  "name": "Display Name",        // User's username or display name
  "email": "user@example.com",   // Email (optional, may be null)
  "url": "https://profile-url",  // Profile URL (optional)
  "avatar": "https://avatar-url", // Avatar URL (optional)
  "platform": "github"           // Platform identifier
}
```

**Key Benefits:**
- ✅ **Consistent Structure** - Same response format from all providers
- ✅ **Data Validation** - All responses are validated and normalized
- ✅ **Platform UUID** - Uses unique provider ID, not email as primary key
- ✅ **Error Standardization** - Consistent error response format

## Deploy Your Own

Deploy your own Waline Auth project with Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/walinejs/auth)

## Quick Start

### 1. Local Development

```bash
git clone https://github.com/walinejs/auth.git
cd auth
npm install
npm start
# Server runs at http://localhost:3000
```

### 2. Environment Configuration

Create `.env.local`:

```env
# GitHub
GITHUB_ID=your_github_id
GITHUB_SECRET=your_github_secret

# Google
GOOGLE_ID=your_google_id
GOOGLE_SECRET=your_google_secret

# QQ
QQ_ID=your_qq_id
QQ_SECRET=your_qq_secret

# Add other platforms as needed...
```

### 3. Test the Service

Visit `http://localhost:3000` to see available authentication services.

## Complete Documentation

📖 **[Full Technical Guide](./TECHNICAL_GUIDE.md)** - Comprehensive setup and integration guide

This guide includes:
- Detailed platform-specific configuration
- Complete API endpoint documentation
- Response examples for each platform
- Error handling best practices
- Troubleshooting guide
- Integration examples

## How To Use

### GitHub

`GITHUB_ID` and `GITHUB_SECRET` enviroment variables are required.

**Setup Guide:** [See Technical Guide](./TECHNICAL_GUIDE.md#github)

- Redirect URL: `<a href="<serverUrl>/github?redirect=<callbackUrl>&state=<stateValue>">Login with GitHub</a>`
- Get user info: `GET <serverUrl>/github?code=<code>&state=<state>`
- **Response:** Unified format with `id`, `name`, `email`, `avatar`, `platform`

### Google

`GOOGLE_ID` and `GOOGLE_SECRET` enviroment variables are required.

**Setup Guide:** [See Technical Guide](./TECHNICAL_GUIDE.md#google)

- Redirect URL: `<a href="<serverUrl>/google?redirect=<callbackUrl>&state=<stateValue>">Login with Google</a>`
- Get user info: `GET <serverUrl>/google?code=<code>&state=<state>`
- **Response:** Unified format with `id`, `name`, `email`, `avatar`, `platform`

### Facebook

`FACEBOOK_ID` and `FACEBOOK_SECRET` enviroment variables are required.

**Setup Guide:** [See Technical Guide](./TECHNICAL_GUIDE.md#facebook)

- Redirect URL: `<a href="<serverUrl>/facebook?redirect=<callbackUrl>&state=<stateValue>">Login with Facebook</a>`
- Get user info: `GET <serverUrl>/facebook?code=<code>&state=<state>`
- **Response:** Unified format with `id`, `name`, `email`, `avatar`, `platform`

### Weibo

`WEIBO_ID` and `WEIBO_SECRET` enviroment variables are required.

**Setup Guide:** [See Technical Guide](./TECHNICAL_GUIDE.md#weibo)

- Redirect URL: `<a href="<serverUrl>/weibo?redirect=<callbackUrl>&state=<stateValue>">Login with Weibo</a>`
- Get user info: `GET <serverUrl>/weibo?code=<code>&state=<state>`
- **Response:** Unified format with `id`, `name`, `email`, `avatar`, `platform`

### QQ

`QQ_ID` and `QQ_SECRET` environment variables are required.

**Setup Guide:** [See Technical Guide](./TECHNICAL_GUIDE.md#qq)

- Redirect URL: `<a href="<serverUrl>/qq?redirect=<callbackUrl>&state=<stateValue>">Login with QQ</a>`
- Get user info: `GET <serverUrl>/qq?code=<code>&state=<state>`
- **Response:** Unified format with `id`, `name`, `email`, `avatar`, `platform`

### Twitter

`TWITTER_ID` and `TWITTER_SECRET` environment variables are required (OAuth 2.0 PKCE).

**Setup Guide:** [See Technical Guide](./TECHNICAL_GUIDE.md#twitter)

- Redirect URL: `<a href="<serverUrl>/twitter?redirect=<callbackUrl>&state=<stateValue>">Login with Twitter</a>`
- Get user info: `GET <serverUrl>/twitter?code=<code>&state=<state>`
- **Response:** Unified format with `id`, `name`, `email`, `avatar`, `platform`
- **Note:** Uses stateless PKCE with URL-encoded state, no backend storage required

### OIDC (OpenID Connect)

`OIDC_ID`, `OIDC_SECRET` and either `OIDC_ISSUER` or explicit endpoints `OIDC_AUTH_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL` are required.  
Optional: `OIDC_SCOPES` (default `openid profile email`).

**Setup Guide:** [See Technical Guide](./TECHNICAL_GUIDE.md#openid-connect-oidc)

- Redirect URL: `<a href="<serverUrl>/oidc?redirect=<callbackUrl>&state=<stateValue>">Login with OIDC</a>`
- Get user info: `GET <serverUrl>/oidc?code=<code>&state=<state>`
- **Response:** Unified format with `id`, `name`, `email`, `avatar`, `platform`

## Example Integration

```javascript
// Frontend: Initiate OAuth login
const login = async (provider) => {
  const redirectUrl = `${window.location.origin}/auth/callback`;
  const state = generateRandomState();
  
  // Save state for CSRF protection
  sessionStorage.oauth_state = state;
  
  // Redirect to Waline Auth
  window.location.href = 
    `https://auth.example.com/${provider}?` +
    `redirect=${encodeURIComponent(redirectUrl)}&state=${state}`;
};

// Backend: Handle callback
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Verify state
  if (state !== sessionStorage.oauth_state) {
    return res.status(400).json({ error: 'CSRF token mismatch' });
  }
  
  // Get user from Waline Auth
  const userData = await fetch(
    `https://auth.example.com/${provider}?code=${code}&state=${state}`
  ).then(r => r.json());
  
  // userData structure:
  // { id, name, email, url, avatar, platform }
  
  // Create/update user
  const user = await User.upsert({
    [`${userData.platform}_id`]: userData.id,
    email: userData.email,
    name: userData.name,
    avatar: userData.avatar
  });
  
  // Set session
  req.session.user = user;
  
  res.redirect('/dashboard');
});
```

## Error Handling

All errors return a standardized format:

```json
{
  "errno": 400,
  "message": "Detailed error message"
}
```

**Common Error Codes:**
- `400` - Invalid request or missing parameters
- `401` - Authentication failed or access denied
- `403` - Forbidden (user denied access)
- `500` - Server error

See [Error Handling](./TECHNICAL_GUIDE.md#error-handling) in the technical guide for details.

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in dashboard
# Then redeploy
vercel deploy --prod
```

### Docker

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
```

## Project Structure

```
├── index.js                 # Main entry point
├── package.json            # Dependencies
├── TECHNICAL_GUIDE.md      # Complete documentation
├── src/
│   ├── base.js             # Base OAuth class with unified response
│   ├── github.js           # GitHub OAuth handler
│   ├── google.js           # Google OAuth handler
│   ├── qq.js               # QQ OAuth handler
│   ├── facebook.js         # Facebook OAuth handler
│   ├── weibo.js            # Weibo OAuth handler
│   ├── twitter.js          # Twitter OAuth 2.0 handler
│   ├── oidc.js             # OIDC/OpenID Connect handler
│   ├── index.js            # Service registry
│   └── utils/
│       ├── response.js     # Unified response formatter
│       ├── validators.js   # Data validation utilities
│       ├── index.js        # Utilities export
│       └── storage/
│           └── (Deprecated: LeanCloud storage removed)
└── vercel.json             # Vercel configuration
```

## What's New in v1.2.0

✨ **Unified Response System**
- All OAuth providers now return the same standardized JSON structure
- Platform-specific data is normalized and validated automatically
- Improved error handling with consistent error codes

✨ **Enhanced Utilities**
- `UserResponse` class for building validated user responses
- Validation functions for email, URLs, and IDs
- Data sanitization utilities
- Helper functions for common operations

✨ **Complete Documentation**
- Comprehensive technical guide with setup instructions
- Platform-specific configuration guide
- API endpoint documentation with examples
- Error handling and troubleshooting guide
- Security best practices

📚 **[See TECHNICAL_GUIDE.md](./TECHNICAL_GUIDE.md) for complete documentation**

## FAQ

**Q: Do I need to set all platform environment variables?**
A: No. Only set environment variables for platforms you want to use. The service automatically enables providers with valid credentials.

**Q: Is this only for Waline?**
A: No. This is a universal OAuth service that works with Waline, but can also integrate with any web application. Waline is just one example use case.

**Q: Does the response format change between platforms?**
A: No. The response is always in the same unified format: `{ id, name, email, url, avatar, platform }`. This is a key improvement in v1.2.0.

**Q: How do I secure the client secret?**
A: Use Vercel environment variables. Never commit secrets to git or expose them in frontend code.

**Q: What's the difference between `id` and other fields?**
A: `id` is the platform's unique identifier and should be used as your app's primary key. It never changes across logins.

## Support

- **GitHub Issues:** https://github.com/walinejs/auth/issues
- **Discussions:** https://github.com/walinejs/auth/discussions
- **Documentation:** [TECHNICAL_GUIDE.md](./TECHNICAL_GUIDE.md)

## Use Cases

- **Waline Comment System** - Integrate with Waline for user authentication
- **Static Sites** - Add user authentication to Jekyll, Hugo, or other static site generators
- **SPA Applications** - Use with React, Vue, Angular, or other single-page applications
- **Backend Services** - Integrate with Node.js, Python, or other server applications
- **Mobile Apps** - Support OAuth login in mobile applications
- **Custom Projects** - Any application that needs OAuth authentication

## License

MIT © 2024 Waline Contributors

  [GitHub]: https://github.com
  [Twitter]: https://twitter.com
  [Facebook]: https://facebook.com
  [Google]: https://google.com
  [Weibo]: https://weibo.com
  [QQ]: https://qq.com
  [OIDC]: https://openid.net/connect/

