# MOBILE-DESIGN.md

Design source of truth for the Ludo shell. Read this before any UI decision. A later
pass refreshes it and reports what changed rather than regenerating it.

Scope: the shell only. `LudoBoard`, `Tokens`, `StymiteFace`, `Wall`, `FireZone` and the
board geometry in `constants.js` are **out of scope and must not be restyled**. The game
screen may only have its background and its buttons changed.

## App Read

```
APP READ: turn-based board game for friends playing together, playful-premium
language, leaning fully custom on Expo + StyleSheet + Reanimated.
platforms: iOS first-class · Android first-class · web for testing two clients
posture: unified-brand
offline: N/A for the shell's own data (no feeds); the four game modes declare
         their own network needs on the card
```

The audience is people about to play a game with friends, usually one-handed, often
waiting for someone else to join. That picks two things: targets stay large, and every
waiting state has to say what it is waiting for.

## Nav Read

```
NAV READ
platforms: iOS + Android first-class (web: dev/testing)
tabs: none. This is a linear session flow, not a browsing app — tabs would be
      four destinations nobody returns to.

flow  SPLASH → AUTH → HOME → TEAMS → [LOBBY] → GAME
                ↑                                  │
                └───────────── sign out ───────────┘

SPLASH   brand hold, one action
AUTH     Google · Facebook · guest, plus an offline escape hatch
HOME     the four modes, profile strip, settings entry, resume banner
TEAMS    FFA / 1v1 / 2v2
LOBBY    online only — matchmaking queue, or room code create/join
GAME     out of scope except background and buttons
SETTINGS behind the profile strip on HOME. Never a tab (tell 25)

entry points: SETTINGS ← profile strip (HOME) · GAME ← TEAMS (offline) or LOBBY (online)
sheets: none
android back: mirrors the in-screen back control at every step
max taps from HOME to a game: 2 offline, 3 online
```

There is no native navigator, so this shell owns its own safe areas, press states and
back parity. That is the cost of `DESIGN_EXPRESSION: 8` and it is paid deliberately.

## Dials

```
DESIGN_EXPRESSION: 8   fully custom
MOTION_INTENSITY:  6   springs and layout transitions, no gesture physics
VISUAL_DENSITY:    3   airy; few choices per screen
```

`EXPRESSION: 8` is justified rather than default: the app has no native navigation
chrome to lag behind (CHROME LAGS CONTENT has nothing to hold back here), and a game
lobby that looks like Settings.app is the wrong read. Category bias is the "kids /
playful" row: targets at least 56pt on primary choices, high contrast, no dark patterns.

`MOTION: 6` is above the reduced-motion floor, so `useReducedMotion` is honored on
everything decorative. Gameplay feedback keeps overriding it — see `motion.js`.

## The concept: a lit table

The shell is a dark table with a single pool of light over it. Content sits in the light.
That is the whole idea, and it replaces the previous look (overlapping translucent
prisms with outlined dice scattered across them), which had no compositional logic and
left every surface muddy and semi-transparent.

Consequences that are binding:

- **One gradient in the entire app**, the pool of light in `Backdrop`. Nothing else
  gradients. The old build had twelve.
- **Surfaces are opaque.** The old auth buttons were translucent and had decorative dice
  visibly floating through them, which read as a rendering bug.
- **No decorative floating objects.** Deleted rather than rearranged.

## The signature element

Each screen gets at most one bold move. Here it is the **seat diagram**: a small
four-cell figure showing who sits where, in the seat colours.

It carries the game's own language, teaches the seating a mode implies, and is
distinctive to this app. It is also the reason the mode cards need no icons, which is
what keeps this shell clear of tell 1 (emoji icons) and tell 4 (the icon chip row) at
the same time.

| Screen | Its one bold move |
| --- | --- |
| Splash | the wordmark, over the seat spectrum |
| Auth | the wordmark; the form stays quiet |
| Home | four mode cards, each with its seat diagram |
| Teams | the seat diagrams at full size |
| Lobby | the room code as the hero |
| Settings | none. It is a grouped list and should look like one |

## Tokens

Defined once in `theme.js`. **Screens import tokens and contain no literal colours.**

### Colour

Dark only, and deliberately so: this is a game played in the evening, and a light mode
nobody asked for is two palettes to keep honest instead of one. `bg` is near-black
rather than pure black so the elevation ramp has somewhere to go.

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#08080C` | the table |
| `surface` | `#121218` | cards, panels |
| `surfaceHi` | `#1B1B23` | inputs, raised rows |
| `line` | `#262630` | hairlines, borders |
| `textHi` | `#F2F2F5` | headings, primary |
| `textMid` | `#A0A0AE` | secondary, subtitles |
| `textLow` | `#6B6B7B` | captions, disabled |
| `accent` | `#3FD0C9` | the single accent, ~62% saturation |
| `accentInk` | `#04100F` | text on accent |
| `danger` | `#E5484D` | destructive only |
| `success` | `#46A758` | connected, ready |

One accent, used identically everywhere. It is a teal specifically because it is not any
of the four seat colours, so it never reads as "you are this colour".

### Seat colour is categorical, not decorative

| Seat | Value |
| --- | --- |
| GREEN | `#34C759` |
| YELLOW | `#FFD426` |
| BLUE | `#3B82F6` |
| RED | `#FF453A` |

These appear **only where they mean a seat**: seat diagrams, player rows, and the "you
are BLUE" strip in game. Never as decoration, never as a card background.

### Type

System fonts. On mobile that is the quality choice, not a shortcut, and it is what makes
Dynamic Type work without a font-loading flash.

| Token | Size / line | Weight |
| --- | --- | --- |
| `display` | 44 / 48 | 800 |
| `title` | 22 / 28 | 700 |
| `heading` | 17 / 22 | 700 |
| `body` | 15 / 21 | 500 |
| `label` | 13 / 16 | 600 |
| `caption` | 11 / 14 | 700, tracked |

`maxFontSizeMultiplier` 1.3 on custom chrome (buttons, headers). Body text unbounded.

### Shape, spacing, elevation

- Radius lock: `8` inputs and chips · `12` cards · `16` big choice cards. `pill` for the
  avatar only. Nothing else is round.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32.
- Screen horizontal padding: **20**, everywhere, locked.
- Elevation: two levels only, each defining iOS shadow **and** Android `elevation`
  together. A `shadowColor` without an `elevation` sibling is invisible on Android
  (tell 5) and is a bug, not a style.

### Motion

- Press: spring to 0.97. Every touchable, no exceptions.
- Screen enter: fade plus an 8pt rise, one stagger group, never per-element.
- Shot clock and dice: gameplay feedback, overrides reduced motion (`motion.js`).
- Everything else: honors `useReducedMotion`.
- No infinite looping attention-grabbers. The old splash button pulsed forever, which
  is both a tell and, in practice, made the button impossible for automation to click
  because it never came to rest.

## Icons

`@expo/vector-icons`, **Ionicons only**, one size scale.

One deliberate exception: the Google and Facebook marks on the auth screen use
`FontAwesome`'s brand glyphs, because Ionicons has no brand marks and the alternative
was the letters "G" and "f", which read as typos rather than logos. Brand marks are the
only place a second family is allowed.

Never emoji as icons.

## Copy rules

- No em-dashes or en-dashes in any visible string. Hyphen, or restructure.
- No filler verbs, no exclamation onboarding voice, no greeting headers.
- Waiting states name what they are waiting for and roughly how long.
- Every destructive action says what it destroys.
