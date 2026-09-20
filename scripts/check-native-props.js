// Catches prop values a browser accepts and Android refuses.
//
// Worth having because the fifth APK closed on launch with every other check
// green: the tutorial's Next button passed
// `accessibilityState={{ disabled: moving || scoringAnimation }}`, which is
// `null` whenever no score is animating. Web shrugs. Android's BaseViewManager
// calls getBoolean() on it and the whole app dies before the first screen. A
// boolean prop handed an object, string or number goes the same way, and so
// does a style value that `&&` turns into `false`.
//
// "True or false" means provably so from the expression itself: a literal, a
// `!`, a comparison, Boolean(...), or &&/||/?: made only of those. A bare
// variable does not count, because the bug was a variable that was *usually* a
// boolean. Coerce it with `!!` at the element and the check is satisfied.
//
//   node scripts/check-native-props.js       (or: npm run check)

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const root = path.join(__dirname, '..');
const DIRS = ['.', 'components', 'components/symbols', 'screens'];

// Components that hand their props straight to an Android view.
const HOST = /^(View|Text|TextInput|Image|ImageBackground|ScrollView|FlatList|Pressable|Touchable\w*|Modal|Switch|SafeAreaView|Animated\.\w+|Animated[A-Z]\w*)$/;
// Where bare text is a crash ("Text strings must be rendered within a <Text>").
const BOX = /^(View|ScrollView|Pressable|Touchable\w*|SafeAreaView|Animated\.View|Animated\.ScrollView|AnimatedPressable|AnimatedView)$/;
const BOOL_PROPS = new Set([
  'disabled', 'accessible', 'selectable', 'editable', 'focusable', 'collapsable',
  'adjustsFontSizeToFit', 'allowFontScaling', 'visible', 'transparent',
  'aria-disabled', 'aria-selected', 'aria-checked', 'aria-busy', 'aria-expanded'
]);
const COMPARE = new Set(['==', '!=', '===', '!==', '<', '>', '<=', '>=', 'in', 'instanceof']);

const isBool = (n) => {
  if (!n) return false;
  switch (n.type) {
    case 'BooleanLiteral': return true;
    case 'UnaryExpression': return n.operator === '!';
    case 'BinaryExpression': return COMPARE.has(n.operator);
    case 'LogicalExpression': return n.operator !== '??' && isBool(n.left) && isBool(n.right);
    case 'ConditionalExpression': return isBool(n.consequent) && isBool(n.alternate);
    case 'CallExpression': return n.callee.type === 'Identifier' && n.callee.name === 'Boolean';
    default: return false;
  }
};

const tagName = (n) => (n.type === 'JSXIdentifier' ? n.name
  : n.type === 'JSXMemberExpression' ? `${tagName(n.object)}.${n.property.name}` : '');

const files = [];
for (const dir of DIRS) {
  let entries = [];
  try {
    entries = fs.readdirSync(path.join(root, dir));
  } catch {
    continue;
  }
  for (const f of entries) if (f.endsWith('.js')) files.push(path.join(dir, f));
}

let problems = 0;
const report = (file, node, message) => {
  console.error(`  ${file}:${node.loc.start.line}  ${message}`);
  problems++;
};

for (const file of files) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');

  // React Native 0.86 has no StyleSheet.absoluteFillObject (web still does).
  // Spreading it spreads undefined, so a "fill" layer silently joins the layout
  // flow: the home backdrop took the whole screen on Android and pushed the
  // ScrollView to y=800 with zero height — content gone, background left.
  src.split('\n').forEach((line, i) => {
    if (line.includes('StyleSheet.absoluteFillObject')) {
      console.error(`  ${file}:${i + 1}  StyleSheet.absoluteFillObject is undefined on native; use StyleSheet.absoluteFill`);
      problems++;
    }
  });

  if (!/<[A-Za-z]/.test(src)) continue;
  const ast = babel.parseSync(src, {
    filename: file, babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'] }
  });

  babel.traverse(ast, {
    JSXAttribute(p) {
      const prop = p.node.name.name;
      const tag = tagName(p.parentPath.node.name);
      const value = p.node.value;
      const expr = value && value.type === 'JSXExpressionContainer' ? value.expression : null;

      if (prop === 'accessibilityState') {
        if (!expr || expr.type !== 'ObjectExpression') {
          report(file, p.node, 'accessibilityState must be an object literal, so each value can be checked');
          return;
        }
        for (const entry of expr.properties) {
          if (entry.type !== 'ObjectProperty') {
            report(file, entry, 'accessibilityState: no spreads, list each state');
            continue;
          }
          const key = entry.key.name || entry.key.value;
          if (key === 'checked' && entry.value.type === 'StringLiteral' && entry.value.value === 'mixed') continue;
          if (!isBool(entry.value)) report(file, entry, `accessibilityState.${key} must be true or false (use !!)`);
        }
        return;
      }

      // Reanimated layout animations left everything inside them invisible and
      // untouchable on Android (the home screen was only its backdrop) while web
      // drew them fine. `Rise` in components/ui.js is the entrance to use.
      if (/^Animated/.test(tag) && (prop === 'entering' || prop === 'exiting' || prop === 'layout')) {
        report(file, p.node, `<${tag} ${prop}> Reanimated layout animations break on Android; use <Rise>`);
      }

      if (HOST.test(tag) && BOOL_PROPS.has(prop) && value && !isBool(expr)) {
        report(file, p.node, `<${tag} ${prop}> must be true or false (use !!)`);
      }

      if (prop === 'style' && expr) {
        p.get('value.expression').traverse({
          ObjectProperty(q) {
            const v = q.node.value;
            if (v.type === 'LogicalExpression' && v.operator === '&&') {
              report(file, v, 'a style value built with && can be `false`, which Android rejects (use ?: )');
            }
          }
        });
      }
    },

    JSXText(p) {
      if (!p.node.value.trim()) return;
      const parent = p.parentPath.node;
      if (parent.type !== 'JSXElement') return;
      const tag = tagName(parent.openingElement.name);
      if (BOX.test(tag)) report(file, p.node, `bare text inside <${tag}>; wrap it in <Text>`);
    },

    JSXExpressionContainer(p) {
      const e = p.node.expression;
      if (p.parentPath.node.type !== 'JSXElement') return;
      if (e.type === 'LogicalExpression' && e.operator === '&&'
          && e.left.type === 'MemberExpression' && e.left.property.name === 'length') {
        report(file, e, '`x.length && ...` renders a bare 0 when empty, which Android rejects (use > 0)');
      }
    }
  });
}

if (problems > 0) {
  console.error(`\n${problems} Android-unsafe prop value(s) found.`);
  process.exit(1);
}

console.log(`Checked ${files.length} files — every native prop value is Android-safe.`);
