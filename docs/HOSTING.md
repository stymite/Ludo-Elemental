# Ludo website hosting

The static website lives in `docs/`: homepage, privacy policy, account deletion
instructions, and `app-ads.txt`. `firebase.json` publishes that directory through
Firebase Hosting without publishing Markdown documents or hidden files.

GitHub Pages is configured for `main:/docs`, but this account's user site has
`stymite.me` as its custom domain. The project inherits that domain. Its project
subpath also does not provide the hostname-root `app-ads.txt` AdMob crawls.
Use a dedicated Firebase Hosting site with its free HTTPS `web.app` hostname.
No paid domain is required, and no personal website configuration needs changing.

## First deployment

```sh
firebase login --reauth
firebase projects:create <unique-ludo-project-id> --display-name "Ludo Elemental"
firebase deploy --only hosting --project <unique-ludo-project-id>
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
command again with the same project ID. Keep both copies of `app-ads.txt` identical.
