const fs = require('fs');
const path = require('path');

const aligarhPath = path.join(__dirname, '..', 'assets', 'aligarh.otf');
const outPath = path.join(__dirname, '..', 'assets', 'aligarh-font.js');

const b64 = fs.readFileSync(aligarhPath).toString('base64');
const content = `// Auto-generated Base64 representation of assets/aligarh.otf
export const ALIGARH_BASE64 = '${b64}';
`;

fs.writeFileSync(outPath, content);
console.log('Successfully created assets/aligarh-font.js (size:', b64.length, ')');
