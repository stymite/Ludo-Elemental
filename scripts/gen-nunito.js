const fs = require('fs');
const path = require('path');

const nunitoPath = path.join(__dirname, '..', 'assets', 'nunito.bold.ttf');
const outPath = path.join(__dirname, '..', 'assets', 'nunito-font.js');

const b64 = fs.readFileSync(nunitoPath).toString('base64');
const content = `// Auto-generated Base64 representation of assets/nunito.bold.ttf
export const NUNITO_BASE64 = '${b64}';
`;

fs.writeFileSync(outPath, content);
console.log('Successfully created assets/nunito-font.js with base64 font (size:', b64.length, ')');
