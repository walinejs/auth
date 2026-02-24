# OAuth Center

The easiest way to add user login to websites with [GitHub][GitHub], [Twitter][Twitter], [Facebook][Facebook], [Google][Google], [Weibo][Weibo], [QQ][QQ], [OpenID Connect (OIDC)][OIDC] and [Huawei][Huawei].

## Deploy Your Own

Deploy your own Waline project with Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/walinejs/auth)

## How To Use
### GitHub

`GITHUB_ID` and `GITHUB_SECRET` enviroment variables are required.

- Redirect URL: `<a href="<serverUrl>/github?redirect=&state=">Login with GitHub</a>`
- Get user info: `GET <serverUrl>/github?code=`

### Twitter

`TWITTER_ID`, `TWITTER_SECRET`, `LEAN_ID` and `LEAN_KEY` environment variables are required. `LEAN_ID` and `LEAN_KEY` can got from <https://leancloud.app>.

- Redirect URL: `<a href="<serverUrl>/twitter?redirect=&state=">Login with Twitter</a>`
- Get user info: `GET <serverUrl>/twitter?oauth_token=&oauth_verifier`
### Facebook

`FACEBOOK_ID` and `FACEBOOK_SECRET` enviroment variables are required.

- Redirect URL: `<a href="<serverUrl>/facebook?redirect=&state=">Login with Facebook</a>`
- Get user info: `GET <serverUrl>/facebook?code=`

### Google

`GOOGLE_ID` and `GOOGLE_SECRET` enviroment variables are required.

- Redirect URL: `<a href="<serverUrl>/google?redirect=&state=">Login with Google</a>`
- Get user info: `GET <serverUrl>/google?code=`

### Weibo

`WEIBO_ID` and `WEIBO_SECRET` enviroment variables are required.

- Redirect URL: `<a href="<serverUrl>/weibo?redirect=&state=">Login with Weibo</a>`
- Get user info: `GET <serverUrl>/weibo?code=`

### QQ

`QQ_ID` and `QQ_SECRET` environment variables are required.

- Redirect URL: `<a href="<serverUrl>/qq?redirect=&state=">Login with QQ</a>`
- Get user info: `GET <serverUrl>/qq?code=`

### OIDC (OpenID Connect)

`OIDC_ID`, `OIDC_SECRET` and either `OIDC_ISSUER` or explicit endpoints `OIDC_AUTH_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL` are required.  
Optional: `OIDC_SCOPES` (default `openid profile email`).

- Redirect URL: `<a href="<serverUrl>/oidc?redirect=&state=">Login with OIDC</a>`
- Get user info: `GET <serverUrl>/oidc?code=`

### Huawei

`HUAWEI_ID` and `HUAWEI_SECRET` environment variables are required.

- Redirect URL: `<a href="<serverUrl>/huawei?redirect=&state=">Login with Huawei</a>`
- Get user info: `GET <serverUrl>/huawei?code=`


  [GitHub]: https://github.com
  [Twitter]: https://twitter.com
  [Facebook]: https://facebook.com
  [Google]: https://google.com
  [Weibo]: https://weibo.com
  [QQ]: https://qq.com
  [OIDC]: https://openid.net/connect/
  [Huawei]: https://developer.huawei.com/
