# CLAUDE.md

Expo / React Native Ludo with an elemental powers layer and online play.

## How to work in here — ponytail rules

Lazy senior dev. Lazy means efficient, not careless. The best code is the code
never written. Before writing any, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse it.
3. Does the standard library do it?
4. Does a native platform feature cover it?
5. Does an already-installed dependency solve it?
6. Can it be one line?
7. Only then: the minimum code that works.

The ladder runs *after* you understand the problem, not instead of it. Trace
the real flow end to end, then climb. The smallest change in the wrong place
isn't lazy, it's a second bug.

**Bug fix = root cause, not symptom.** A report names a symptom. Grep every
caller of the function you touch and fix the shared function once — patching
only the path the report names leaves a sibling caller still broken.

Deletion over addition. Boring over clever. Fewest files. No abstractions
nobody asked for, no new dependency that can be avoided. Mark a deliberate
corner-cut that has a known ceiling with a `ponytail:` comment naming the
ceiling and the upgrade path.

**Not lazy about:** understanding the problem, validation at trust boundaries,
error handling that prevents data loss, security, accessibility, anything
explicitly requested.

**Lazy code without its check is unfinished.** Non-trivial logic leaves ONE
runnable check behind — the smallest thing that fails if the logic breaks. An
assert-based demo or one small file; no frameworks, no fixtures. That is what
`engine-demo.js`, `online-demo.js`, and `scripts/check-imports.js` are, and why
`npm run check` runs all three. Trivial one-liners need no test.

`.agents/rules/instructions.md` mirrors this for other tooling, and
`.claude/skills/ponytail/SKILL.md` is the on-demand version with its intensity
modes. Keep the three in step if you edit one.

## Commands

```bash
npm start                 # Expo dev server
npm run web               # browser, useful for testing two clients at once
npm run check             # lint + missing-import scan + worklet scan + engine/tutorial/online suites
npx expo export --platform web   # proves the whole tree bundles
eas build -p android --profile preview   # the sideloadable APK
```

Run `npm run check` before committing. It is fast and catches the three things
that do not show up as build errors.

## Dev environment

Skills live in `.claude/skills/`. Installed by vendoring, not by
`claude plugin` — this machine runs the VS Code extension, which ships no
`claude` binary, so there is no marketplace command available.

- **Expo official** (`expo-*`, `eas-*`) — a curated subset of
  [expo/skills](https://github.com/expo/skills). Expo's guidance is the source
  of truth. Re-sync by copying `plugins/expo/skills/<name>` from upstream.
- **Draftbit mobile-taste suite** (`mobile-*`) — RN/Expo design taste. The
  skills reference `../_shared/`, so that folder must stay a sibling of them.
- **`mobile-app-design`** — platform conventions (HIG / Material), a11y.
- **`ponytail`** — this project's own house style, see above.

MCP servers are in `.mcp.json`, all zero-config:

- **expo** — official (650 Industries). Talks to a running dev server: logs,
  screenshots, platform targeting. Start `npm start` first or it has nothing to
  attach to.
- **playwright** — drives the web build (`npm run web`). The only way to
  actually *see* a render rather than trusting that it bundled.
- **context7** — current library docs. Worth using for Reanimated and Expo APIs
  rather than recalling them.

Two more are deliberately **not** enabled because both need a secret and fail
noisily without one. Add to `.mcp.json` when you want them:

```jsonc
"supabase": { "command": "cmd", "args": ["/c","npx","-y","@supabase/mcp-server-supabase@latest","--read-only","--project-ref=tnkvnfxlyitqnrftkqht"], "env": { "SUPABASE_ACCESS_TOKEN": "<personal access token>" } }
"github":   { "command": "cmd", "args": ["/c","npx","-y","@modelcontextprotocol/server-github@latest"], "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<pat>" } }
```

No filesystem MCP: Read/Write/Edit/Glob/Grep already cover it, and a second
copy is pure noise.

## Shape of the thing

`engine.js` is plain CommonJS and knows nothing about React — no imports from
the UI, no JSX, no side effects beyond the state object it is handed. That is
what lets `engine-demo.js` and `online-demo.js` drive it straight from Node.
Keep it that way: anything needing `react-native` belongs in `components/`.

The engine **mutates the state object in place** and returns it. React will not
re-render off a mutated reference, so every call site goes through `commit()` in
`App.js`, which shallow-copies `pieces` and deep-copies `players` before
`setGameState`. If a change is not showing up on screen, that is the first thing
to check.

| Path | What it is |
| --- | --- |
| `engine.js` | Rules, turn order, powers. Pure, CommonJS, Node-testable |
| `botEngine.js` | Move selection for computer seats |
| `constants.js` | Board geometry — grid, yard slots, pixel positions |
| `online.js` | Seating + the host's authority rule. Pure, no RN imports |
| `multiplayer.js` | Realtime transport — presence, intents, state broadcast |
| `shop.js` | Cosmetic catalog, ownership, equipping. Pure, `shop-demo.js` checks it |
| `purchases.js` | RevenueCat — prices, buy, restore. The only source of what is owned |
| `components/` | Board, tokens, dice, power UI, Stymite face, shared backdrop |
| `screens/` | Splash, home, lobby, settings |

## Invariants worth not breaking

**Every game mutation goes through `dispatch` / `applyAction` in `App.js`.**
Not `setGameState` directly. `dispatch` is what decides whether this device
applies the action or posts it to the host, and `applyAction` is what runs the
seat check. A handler that calls the engine directly will work perfectly
offline and quietly corrupt every online game.

**Anything on a timer must be gated on `drivesEngine`.** The bot-turn effect and
the forced-auto-play effect both are. Ungated, all four devices fire the same
timer and submit the same move.

**Bots and forced auto-plays pass no `actor`.** That is the host acting as
referee rather than as a seat, and it is why `isActionAllowed` treats a null
actor as exempt from the turn check. Do not "fix" this by passing the active
colour — the host would then refuse to play its own bots.

## Online model

Host-authoritative over one Supabase Realtime channel. No database table and no
login: a room is just a channel name. The host runs the only engine; guests post
intents and render what comes back. Seats are ordered by join time and seat *n*
plays `turnOrder[n]` (0 GREEN, 1 YELLOW, 2 BLUE, 3 RED). Unclaimed seats are
bots, run by the host.

Because nothing records that a room exists, joining a channel nobody is in
succeeds exactly like joining a real one — `_confirmRoomExists` in
`multiplayer.js` is what turns that into "no room with that code".

Full state goes out on every change: ~1.8 KB against a ~256 KB limit, so deltas
would be complexity for nothing.

## Gotchas

`scripts/check-imports.js` exists because a JSX component used but never
imported is invisible until the moment it renders — the file loads, the bundle
builds, and then one rare branch blanks the whole screen. That is exactly how
the dice-value chooser shipped broken: `<Text>` appeared once in `Tokens.js`,
inside the chooser, and was missing from the import list.

`scripts/check-worklets.js` exists for the same reason, one platform over. A
`useAnimatedStyle` / `useAnimatedProps` callback runs on the UI thread on a
phone, and may only call other worklets there. On web it runs on the JS thread,
so calling a plain helper works perfectly — and on Android it throws, Reanimated
reports it as fatal, and the release build closes. `StymiteFace.js` calling
`timing()` from `motion.js` killed the first APK on launch that way: the
tutorial mounts the face at startup. A helper used inside those callbacks needs
a `'worklet'` directive.

`scripts/check-native-props.js` is the third of the same kind. Android
`getBoolean()`s every `accessibilityState` value, and a `disabled` / `visible`
style prop, where web accepts anything: the fifth APK died at launch because
the tutorial's Next button passed `moving || scoringAnimation` — `null` when no
score was animating. It demands a provable true/false (coerce with `!!`), and
also flags bare text outside `<Text>`, `x.length && …` children, and style
values built with `&&`. The crash was found by `withCrashNotice.js` below.

`StyleSheet.absoluteFillObject` does not exist in React Native 0.86 — only
`StyleSheet.absoluteFill`. react-native-web still has the old name, so every
spread of it worked in the browser and spread `undefined` on Android: the
backdrop in `Backdrop.js` joined the layout flow, took the full screen, and
pushed every `Screen`'s ScrollView below the bottom edge (y=800, h=0). Home,
setup, settings and lobby all showed only the background. The same check
script now fails on it. Found with a temporary beacon that streamed device logs
over a public Supabase Realtime channel. It was removed before the Play release:
anyone holding the anon key could read every player's console, so never ship a
diagnostic like that again.

Every Expo native module builds its definition at app start, whether or not any
JavaScript imports it — so adding one is a launch risk on every phone, not just
on the screen that uses it. The third APK added `expo-image-manipulator` and
closed on launch; it was taken out again. Weigh a new native dependency against
that, since there is no Android device or emulator here to catch it.
`components/CrashGuard.js` is the root component: in a release build it turns
an uncaught JavaScript error (render, timer, or a worklet reported as fatal)
into a message screen with Try again, instead of the app closing. React Native
routes fatal JS errors through `ErrorUtils`, so if a build still shows Android's
"keeps stopping" box, the crash is native. `plugins/withCrashNotice.js` posts
any Java/Kotlin crash as a notification with the stack trace; no notification
after a close means a C++ crash. R8 minify is off (see `withAndroidSize.js`):
every APK built with it on closed on launch, and none was ever seen to open.

The splash and adaptive icon come from the `expo-splash-screen` plugin entry and
`assets/adaptive-icon.png` (the logo at 68% of the canvas, so launcher masks do
not crop the wordmark). A top-level `splash` key is ignored on SDK 57, and an
APK built with one shows the template's grey grid instead. Android build size
switches live in `plugins/withAndroidSize.js`.

`metro.config.js` carries the `react-native-svg-transformer` setup. Do not
replace it with the bare `getDefaultConfig` — every `.svg` import dies.

`.env` holds the Supabase URL and anon key and is gitignored; `.env.example`
documents it. Missing config is handled: `supabase.js` falls back to a stub so
the offline modes still run.

## Two repos

This project shares history with `github.com/m-faran/ludo-game` (remote `faran`),
which diverged at `d61fb36`. To pick up work from there:

```bash
git fetch faran && git log --oneline d61fb36..faran/main
```
