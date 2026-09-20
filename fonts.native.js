// Native counterpart to fonts.web.js. Deliberately empty: the web build injects
// @font-face rules from base64, and there is nothing to inject on iOS or Android.
// Its whole job is to keep ~808 KB of embedded font data out of the native bundle
// by being the file Metro resolves there instead.
