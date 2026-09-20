// Web only. The three display faces are embedded as base64 because the web build
// has nowhere to serve a font file from, and @font-face wants a URL.
//
// This file is `.web.js` on purpose. These three imports are ~808 KB of base64,
// and as a plain top-level import in theme.js every byte of it was compiled into
// the native bundle too — where the block below never runs and the data is never
// read. Metro picks this file for web and fonts.native.js everywhere else, so the
// base64 is now reachable only from the platform that uses it.
import { BECAK_BASE64 } from './assets/becak-font';
import { NUNITO_BASE64 } from './assets/nunito-font';
import { ALIGARH_BASE64 } from './assets/aligarh-font';

if (typeof document !== 'undefined') {
  const fontId = 'custom-fonts-face';
  if (!document.getElementById(fontId)) {
    const styleEl = document.createElement('style');
    styleEl.id = fontId;
    styleEl.textContent = `
      @font-face {
        font-family: 'Aligarh';
        src: url(data:font/opentype;base64,${ALIGARH_BASE64}) format('opentype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Aligarh Arabic';
        src: url(data:font/opentype;base64,${ALIGARH_BASE64}) format('opentype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'AligarhArabicFREEPERSONALUSE';
        src: url(data:font/opentype;base64,${ALIGARH_BASE64}) format('opentype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Becak';
        src: url(data:font/opentype;base64,${BECAK_BASE64}) format('opentype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Nunito-Bold';
        src: url(data:font/truetype;base64,${NUNITO_BASE64}) format('truetype');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
      body, div, span, p, text, h1, h2, h3 {
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}
