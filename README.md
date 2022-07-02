# OAuth Center

The easiest way to add user login to websites with [Github][Github], [Twitter][Twitter], [Facebook][Facebook], [Google][Google], [Weibo][Weibo].
## Deploy Your Own

Deploy your own Waline project with Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/walinejs/auth)

## How To Use
### Github

`GITHUB_ID` and `GITHUB_SECRET` enviroment variables are required.

- Rediect URL: `<a href="<serverUrl>/github?redirect=&state=">Login with Github</a>`
- Get user info: `GET <serverUrl>/github?code=`

### Twitter

`TWITTER_ID`, `TWITTER_SECRET`, `LEAN_ID` and `LEAN_KEY` environment variables are required. `LEAN_ID` and `LEAN_KEY` can got from <https://leancloud.app>.

- Rediect URL: `<a href="<serverUrl>/twitter?redirect=&state=">Login with Twitter</a>`
- Get user info: `GET <serverUrl>/twitter?code=`
### Facebook

`FACEBOOK_ID` and `FACEBOOK_SECRET` enviroment variables are required.

- Rediect URL: `<a href="<serverUrl>/facebook?redirect=&state=">Login with Facebook</a>`
- Get user info: `GET <serverUrl>/facebook?code=`

### Google

`GOOGLE_ID` and `GOOGLE_SECRET` enviroment variables are required.

- Rediect URL: `<a href="<serverUrl>/google?redirect=&state=">Login with Google</a>`
- Get user info: `GET <serverUrl>/google?code=`

### Weibo

`WEIBO_ID` and `WEIBO_SECRET` enviroment variables are required.

- Rediect URL: `<a href="<serverUrl>/weibo?redirect=&state=">Login with Weibo</a>`
- Get user info: `GET <serverUrl>/weibo?code=`

  [Github]: https://github.com
  [Twitter]: https://twitter.com
  [Facebook]: https://facebook.com
  [Google]: https://google.com
  [Weibo]: https://weibo.com
