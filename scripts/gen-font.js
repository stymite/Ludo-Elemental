const fs = require('fs');
const path = require('path');

const otfPath = path.join(__dirname, '..', 'assets', 'becak.otf');
const outPath = path.join(__dirname, '..', 'assets', 'becak-font.js');

const b64 = fs.readFileSync(otfPath).toString('base64');
const content = `// Auto-generated Base64 representation of assets/becak.otf
export const BECAK_BASE64 = '${b64}';
`;

fs.writeFileSync(outPath, content);
console.log('Successfully created assets/becak-font.js with base64 font (size:', b64.length, ')');
