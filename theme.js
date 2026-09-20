import { Platform } from 'react-native';
import './fonts';

// The design tokens. Every colour, size, radius and shadow in the shell comes from
// here; screen files contain no literal values. See MOBILE-DESIGN.md for the reasoning.
//
// Dark only, deliberately: this is a game played in the evening, and a light mode nobody
// asked for is two palettes to keep honest instead of one.

export const COLORS = {
  // bg is near-black rather than pure black so the elevation ramp has somewhere to go.
  bg: '#08080C',
  surface: '#121218',
  surfaceHi: '#1B1B23',
  line: '#262630',

  textHi: '#F2F2F5',
  textMid: '#A0A0AE',
  textLow: '#6B6B7B',

  // One accent for the whole app, ~62% saturation. Teal specifically because it is not
  // any of the four seat colours, so it never reads as "you are this colour".
  accent: '#3FD0C9',
  accentInk: '#04100F',
  accentDim: 'rgba(63, 208, 201, 0.14)',

  danger: '#E5484D',
  dangerDim: 'rgba(229, 72, 77, 0.14)',
  success: '#46A758'
};

// Categorical, not decorative. These appear only where they mean a seat: seat diagrams,
// player rows, and the "you are BLUE" strip in game.
export const SEAT = {
  GREEN: '#34C759',
  YELLOW: '#FFD426',
  BLUE: '#3B82F6',
  RED: '#E60026'
};

// Board order. Index matters: 0 and 2 face each other, as do 1 and 3.
export const SEAT_ORDER = ['GREEN', 'YELLOW', 'BLUE', 'RED'];

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Radius lock. 8 inputs and chips, 12 cards, 16 big choice cards, pill for the avatar
// only. Nothing else is round.
export const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 };

// Locked once. Every screen uses this and only this for horizontal padding.
export const SCREEN_PAD = 20;

// Phones are the target; on a wide web window a phone layout stretched to 1440px is
// broken design, so content stops here and centres.
export const MAX_CONTENT = 480;

// System fonts. On mobile that is the quality choice, not a shortcut: it is what makes
// Dynamic Type work with no font-loading flash. includeFontPadding is Android-only and
// removes its extra leading so display type lands where the line height says.
const android = Platform.OS === 'android' ? { includeFontPadding: false } : null;

export const TYPE = {
  display: { fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: 2, ...android },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', ...android },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700', ...android },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '500', ...android },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '600', ...android },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2, ...android }
};

// Custom chrome bounds its scaling so a button cannot grow past its own box. Body text
// is left unbounded on purpose.
export const CHROME_SCALE = 1.3;

// Two levels only, and each defines the iOS shadow AND the Android elevation together.
// A shadowColor without an elevation sibling is invisible on Android, which is a bug
// rather than a style.
export const ELEVATION = {
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  lifted: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  }
};

// Touch targets. 44 is the platform floor; primary choices in a game meant for relaxed
// one-handed play get more.
export const TARGET = { min: 44, comfortable: 56 };
