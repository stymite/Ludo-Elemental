// Exists for one rule: no-undef.
//
// Twice in one day a missing import bundled cleanly and then died at runtime —
// `COLORS` in App.js, and `setPlayerDiceValues`, which left the game unable to
// start at all. Neither is a missing JSX tag, so scripts/check-imports.js could
// not see them, and Metro does not resolve identifiers. Catching this properly
// needs scope analysis, which is what ESLint already does.
//
// Everything stylistic is off. This is a correctness gate, not a style police:
// a lint run that reports 400 formatting opinions gets ignored, and then the
// one real error goes with it.
const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    // supabase/functions is Deno, not React Native: different globals, different
    // module resolution, and its own runtime. Linting it with the app's config
    // reports `Deno is not defined` five times and teaches nobody anything.
    ignores: [
      'dist/*', 'dist-android/*', 'node_modules/*', '.expo/*', '.claude/*',
      'scripts/*', 'supabase/functions/*'
    ]
  },
  {
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      // Reanimated worklets and RN globals the base config already knows about
      // stay allowed; everything below is noise for this codebase.
      'import/no-unresolved': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react/no-unescaped-entities': 'off',
      'no-empty': 'off',
      // The React Compiler rules flag real things — reading an Animated.Value
      // during render, setState inside an effect — but they fire on patterns
      // this codebase uses deliberately, and `npm run check` has to stay a
      // signal rather than a wall of yellow. Warnings, not errors, so the
      // no-undef gate above is what actually fails a run.
      // ponytail: parked at warn. Upgrade path is to fix them file by file as
      // screens move onto Reanimated, then promote to error.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react/display-name': 'off'
    }
  }
];
