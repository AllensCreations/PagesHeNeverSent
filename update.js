import fs from 'fs';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const doPush = args.includes('--push');
const filtered = args.filter(a => a !== '--push');

if (filtered.length < 3) {
  console.log('Usage: node update.js <file> "<old_text>" "<new_text>" [--push]');
  process.exit(1);
}

const [filePath, oldText, newText] = filtered;

if (!fs.existsSync(filePath)) {
  console.error(`❌ File '${filePath}' not found!`);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');
if (!content.includes(oldText)) {
  console.error(`❌ Could not find the exact text in '${filePath}'.`);
  process.exit(1);
}

const updated = content.replace(oldText, newText);
console.log('--- Preview of change ---');
console.log(`- ${oldText}`);
console.log(`+ ${newText}`);
console.log('--------------------------');

fs.writeFileSync(filePath, updated, 'utf8');
console.log(`✅ Updated '${filePath}'.`);

if (!doPush) {
  console.log('ℹ️ Not committing/pushing (pass --push to do so).');
  process.exit(0);
}

try {
  execSync(`git add ${filePath}`);
  execSync(`git commit -m "Update ${filePath} via update.js"`);
  execSync('git push origin main');
  console.log('🚀 Pushed changes to GitHub.');
} catch (err) {
  console.error('⚠️ Git operation failed:', err.message);
}
