# Ludo website hosting

The static website lives in `docs/`: homepage, privacy policy, account deletion
instructions, and `app-ads.txt`. `firebase.json` publishes that directory through
Firebase Hosting without publishing Markdown documents or hidden files.

GitHub Pages is configured for `main:/docs`, but this account's user site has
`stymite.me` as its custom domain. The project inherits that domain. Its project
subpath also does not provide the hostname-root `app-ads.txt` AdMob crawls.
Use a dedicated Firebase Hosting site with its free HTTPS `web.app` hostname.
No paid domain is required, and no personal website configuration needs changing.

## Deployed site

Firebase project: `ludo-elemental-stymite` (created October 6, 2026).

- Website: https://ludo-elemental-stymite.web.app/
- Privacy policy: https://ludo-elemental-stymite.web.app/privacy.html
- Account deletion: https://ludo-elemental-stymite.web.app/privacy.html#delete
- Seller file: https://ludo-elemental-stymite.web.app/app-ads.txt

The default project is saved in `.firebaserc`. No billing account was linked.

## Deploy updates

```sh
firebase deploy --only hosting --project ludo-elemental-stymite
```

After deployment, confirm these return HTTP 200 on the actual hosting hostname:

- `/` — Ludo homepage
- `/privacy.html` — privacy policy and account deletion instructions
- `/app-ads.txt` — exact publisher entry, served as plain text

Set the Google Play listing's developer website to the deployed homepage, and
its privacy policy URL to `/privacy.html`. Set the AdMob consent message's privacy
policy URL to the same deployed policy. The deletion URL is `/privacy.html#delete`.
Then request app-ads.txt verification in AdMob after it can discover the website
through the store listing. Do not submit an unverified or placeholder hostname.

For later updates, commit changes to this repository and run the deployment
command again. If authentication expires, run `firebase login --reauth` first.
Keep both copies of `app-ads.txt` identical.
