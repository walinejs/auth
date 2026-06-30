# OAuth Center

The easiest way to add user login to websites with [GitHub][GitHub], [Twitter][Twitter], [Facebook][Facebook], [Google][Google], [Weibo][Weibo], [QQ][QQ], [OpenID Connect (OIDC)][OIDC] and [Huawei][Huawei].

## Run with Docker

A prebuilt multi-arch image (`linux/amd64` + `linux/arm64`) is published on Docker Hub: [`jianqiao0313/waline-auth`](https://hub.docker.com/r/jianqiao0313/waline-auth) (tags: `latest`, `1.1.0`).

```bash
docker run -d --name waline-auth -p 3000:3000 \
  -e GITHUB_ID=your_github_id \
  -e GITHUB_SECRET=your_github_secret \
  jianqiao0313/waline-auth:latest
```

The service then listens on `http://localhost:3000`. Visit `/` to see the enabled providers, then call e.g. `GET http://localhost:3000/github?code=...` to fetch user info.

Each provider is turned on by passing its credentials as environment variables — see [How To Use](#how-to-use) below for the full list (`GITHUB_*`, `GOOGLE_*`, `FACEBOOK_*`, `WEIBO_*`, `QQ_*`, `TWITTER_*` + `LEAN_*`, `OIDC_*`, `HUAWEI_*`). Override the listening port with `-e PORT=8080`.

### docker compose

```yaml
services:
  waline-auth:
    image: jianqiao0313/waline-auth:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      GITHUB_ID: your_github_id
      GITHUB_SECRET: your_github_secret
      # add other providers as needed, e.g. GOOGLE_ID / GOOGLE_SECRET ...
```

### Build it yourself

```bash
docker build -t waline-auth .
docker run -d -p 3000:3000 -e GITHUB_ID=... -e GITHUB_SECRET=... waline-auth
```

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
