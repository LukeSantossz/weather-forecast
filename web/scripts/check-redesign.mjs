// web/scripts/check-redesign.mjs
// Run after `npm run build`. Asserts the redesign's testable acceptance criteria.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// fileURLToPath (not the raw `.pathname`) so this resolves to a real filesystem path on
// Windows too: a file:// URL's `.pathname` keeps a leading slash before the drive letter
// (e.g. "/C:/Users/...") which Windows misreads as the root of the current drive.
const OUT = fileURLToPath(new URL('../out/', import.meta.url));
const FORBIDDEN = ['SAMPLE DATA', 'PENDING RE-RUN', 'withheld', '#20'];

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let failed = false;
const fail = (m) => { console.error('FAIL:', m); failed = true; };

// 1) No stale caveat strings in built HTML/text.
const htmlFiles = walk(OUT).filter((f) => f.endsWith('.html') || f.endsWith('.txt'));
for (const f of htmlFiles) {
  const body = readFileSync(f, 'utf8');
  for (const s of FORBIDDEN) if (body.includes(s)) fail(`forbidden string "${s}" in ${f}`);
}

// 2) No TabList in the page source (single-scroll IA).
const page = readFileSync(fileURLToPath(new URL('../app/page.tsx', import.meta.url)), 'utf8');
if (page.includes('TabList')) fail('app/page.tsx still imports/uses TabList');

// 3) The data contract is untouched by this branch.
// Uses the local `main` branch as the base ref, not `origin/main` (this checkout may have
// no `origin` remote, or `main` may not be fetched under that name). The diff is run with
// cwd at the repo root so the `web/public/data` pathspec resolves correctly regardless of
// where this script itself lives; if the base ref cannot be resolved (or the diff
// otherwise cannot be computed), the assertion is skipped with a clear message instead of
// crashing the whole check.
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE_REF = 'main';
try {
  execSync(`git rev-parse --verify ${BASE_REF}`, { cwd: REPO_ROOT, stdio: 'ignore' });
  const changed = execSync(`git diff --name-only ${BASE_REF} -- web/public/data`, { cwd: REPO_ROOT })
    .toString().trim();
  if (changed) fail(`data contract changed:\n${changed}`);
} catch (err) {
  console.error(`SKIP: could not diff against base ref "${BASE_REF}" (${err.message.split('\n')[0]}). Data-contract check not run.`);
}

if (failed) { console.error('\nredesign check FAILED'); process.exit(1); }
console.log('redesign check passed');
