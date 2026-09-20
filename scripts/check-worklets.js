// Catches a worklet that calls a plain JavaScript function.
//
// Worth having because this bug cannot be seen where the game is developed. On
// web a useAnimatedStyle callback runs on the JS thread like everything else,
// so calling any helper inside it just works. On a phone it runs on the UI
// thread, where only other worklets exist: the call throws, Reanimated reports
// it as fatal, and a release build closes. StymiteFace calling motion.js's
// timing() did exactly that to the first APK — splash screen, then gone.
//
//   node scripts/check-worklets.js       (or: npm run check)

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const root = path.join(__dirname, '..');
const DIRS = ['.', 'components', 'components/symbols', 'screens'];

// Hooks whose callback Reanimated runs on the UI thread.
const UI_HOOKS = new Set([
  'useAnimatedStyle', 'useAnimatedProps', 'useDerivedValue', 'useAnimatedReaction',
  'useAnimatedScrollHandler', 'useFrameCallback', 'runOnUI'
]);
// Everything these two export is safe to call from a worklet.
const WORKLET_LIBS = new Set(['react-native-reanimated', 'react-native-worklets']);

const parse = (file) => babel.parseSync(fs.readFileSync(file, 'utf8'), {
  filename: file, babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'] }
});

const isFunction = (node) => Boolean(node) && /Function/.test(node.type);
const isWorklet = (node) =>
  isFunction(node) && (node.body.directives || []).some(d => d.value.value === 'worklet');

// The names a module exports as worklets, read once per file.
const workletExports = new Map();
function exportsWorklet(file, name) {
  if (!workletExports.has(file)) {
    const names = new Set();
    babel.traverse(parse(file), {
      ExportNamedDeclaration({ node }) {
        const d = node.declaration;
        if (d && d.type === 'FunctionDeclaration' && isWorklet(d)) names.add(d.id.name);
        if (d && d.type === 'VariableDeclaration') {
          d.declarations.forEach(v => { if (isWorklet(v.init)) names.add(v.id.name); });
        }
      }
    });
    workletExports.set(file, names);
  }
  return workletExports.get(file).has(name);
}

// Metro picks the .native.js variant on a phone, so that is the one that counts.
function resolveLocal(fromFile, source) {
  const base = path.resolve(path.dirname(fromFile), source);
  return ['.native.js', '.js', '']
    .map(ext => base + ext)
    .find(p => fs.existsSync(p) && fs.statSync(p).isFile());
}

// Why this call would throw on the UI thread, or null when it is fine. Only a
// definite function is judged: a value whose shape cannot be known from here
// gets the benefit of the doubt, so a hit is always a real one.
function problemWith(call, worklet, file) {
  const name = call.node.callee.name;
  const binding = call.scope.getBinding(name);
  if (!binding) return null; // a global — Math, String and friends
  if (binding.path.findParent(p => p.node === worklet.node)) return null; // declared inside it

  if (binding.kind === 'module') {
    const source = binding.path.parentPath.node.source.value;
    if (WORKLET_LIBS.has(source)) return null;
    const imported = binding.path.node.imported;
    const target = imported && source.startsWith('.') ? resolveLocal(file, source) : null;
    if (target && exportsWorklet(target, imported.name || imported.value)) return null;
    return `calls ${name} from '${source}', which is not a worklet`;
  }

  const node = binding.path.node;
  const fn = node.type === 'VariableDeclarator' ? node.init : node;
  if (!isFunction(fn) || isWorklet(fn)) return null;
  return `calls ${name}, which is not a worklet`;
}

const files = [];
for (const dir of DIRS) {
  let entries = [];
  try {
    entries = fs.readdirSync(path.join(root, dir));
  } catch {
    continue; // directory is optional
  }
  for (const f of entries) {
    if (f.endsWith('.js')) files.push(path.join(root, dir, f));
  }
}

let problems = 0;

for (const file of files) {
  const checked = new Set();
  const check = (worklet) => {
    if (checked.has(worklet.node)) return;
    checked.add(worklet.node);
    worklet.traverse({
      CallExpression(call) {
        if (call.node.callee.type !== 'Identifier') return;
        const problem = problemWith(call, worklet, file);
        if (!problem) return;
        console.error(`  ${path.relative(root, file)}:${call.node.loc.start.line}: a worklet ${problem}`);
        problems++;
      }
    });
  };

  babel.traverse(parse(file), {
    CallExpression(p) {
      const { callee } = p.node;
      if (callee.type !== 'Identifier' || !UI_HOOKS.has(callee.name)) return;
      const fn = p.get('arguments.0');
      if (fn.node && isFunction(fn.node)) check(fn);
    },
    Function(p) {
      if (isWorklet(p.node)) check(p);
    }
  });
}

if (problems > 0) {
  console.error(`\n${problems} problem(s) found. Mark the helper 'worklet', or compute the value outside the callback.`);
  process.exit(1);
}

console.log(`Checked ${files.length} files — no worklet calls a plain function.`);
