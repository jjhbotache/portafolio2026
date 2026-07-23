import { parseAstro } from '@astrojs/compiler';
import fs from 'node:fs';

const file = process.argv[2];
const content = fs.readFileSync(file, 'utf-8');

try {
  const r = parseAstro(content);
  console.log('Parsed OK');
  console.log('Diagnostics:', JSON.stringify(r.diagnostics, null, 2));
} catch (e) {
  console.error('Parse error name:', e.name);
  console.error('Parse error message:', e.message);
  console.error('Location:', JSON.stringify(e.location, null, 2));
  if (e.frame) console.error('Frame:\n' + e.frame);
  console.error('Hint:', e.hint);
  console.error('Stack:', e.stack);
  process.exit(1);
}
