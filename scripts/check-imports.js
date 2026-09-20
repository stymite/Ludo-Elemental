// Catches JSX components that are used but never imported.
//
// Worth having because this class of bug is invisible until the exact moment
// the component renders: the file loads fine, the bundle builds fine, and then
// one rare branch of the UI blanks the whole screen. That is precisely how the
// dice-value chooser in components/Tokens.js shipped broken — <Text> appeared
// once in the file, inside the chooser, and was missing from the import list,
// so the app only died when a player banked two different rolls.
//
//   node scripts/check-imports.js       (or: npm run check)

const fs = require('fs');
const path = require('path');

const DIRS = ['.', 'components', 'components/symbols', 'screens'];
const root = path.join(__dirname, '..');

const files = [];
for (const dir of DIRS) {
  let entries = [];
  try {
    entries = fs.readdirSync(path.join(root, dir));
  } catch {
    continue; // directory is optional
  }
  for (const f of entries) {
    if (f.endsWith('.js')) files.push(path.join(dir, f));
  }
}

let problems = 0;

for (const file of files) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');

  // A capitalised JSX tag is a component reference; lowercase ones are host
  // elements and are never imported.
  const used = new Set();
  for (const m of src.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)) used.add(m[1]);

  // Only JSX tags are checked here. Bare identifiers (a forgotten `COLORS`
  // import, say) fail exactly the same way, but catching those properly means
  // scope analysis — that is ESLint's no-undef, not a regex. A scan that guesses
  // drowns a real hit in false ones, so this stays narrow on purpose.

  for (const name of used) {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const imported = new RegExp(
      'import\\s+(\\*\\s+as\\s+)?' + n + '\\b' +   // import X / import * as X
      '|[{,]\\s*' + n + '\\s*(,|\\}|\\s+as\\b)' +  // { X }, { a, X }, { X as Y }
      '|[{,]\\s*[A-Za-z0-9_$]+\\s+as\\s+' + n + '\\b' + // { Y as X } — X is the local name
      '|import\\s+' + n + '\\s*[,;]' +
      '|import\\s+' + n + '\\s+from'
    ).test(src);

    const declared = new RegExp('(const|let|var|function|class)\\s+' + n + '\\b').test(src);

    if (!imported && !declared) {
      console.error(`  ${file}: <${name}> is used but never imported or declared`);
      problems++;
    }
  }

  // Check relative imports/requires exist on disk
  const importMatches = src.matchAll(/(?:import\s+(?:[\w*\s{},]*\s+from\s+)?|require\s*\(\s*)['"](\.[^'"]+)['"]/g);
  for (const match of importMatches) {
    const importPath = match[1];
    const resolvedBase = path.resolve(path.dirname(path.join(root, file)), importPath);
    // Metro resolves platform variants before the bare name, so `./fonts` is a
    // real import when only fonts.web.js and fonts.native.js exist. Miss these
    // and the checker reports a broken import for a file that builds fine.
    const extensions = [
      '', '.js', '.jsx', '.json', '.svg', '.png', '.webp', '.jpg', '.jpeg', '.mp4',
      '.web.js', '.native.js', '.ios.js', '.android.js'
    ];
    const exists = extensions.some(ext => {
      const full = resolvedBase + ext;
      if (!fs.existsSync(full)) return false;
      if (fs.statSync(full).isDirectory()) return fs.existsSync(path.join(full, 'index.js'));
      return true;
    });
    if (!exists) {
      console.error(`  ${file}: Cannot resolve import "${importPath}"`);
      problems++;
    }
  }
}

if (problems > 0) {
  console.error(`\n${problems} problem(s) found.`);
  process.exit(1);
}

console.log(`Checked ${files.length} files — every JSX component resolves.`);
