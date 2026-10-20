import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = 'evidence/phase4/qa';
const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
const browser = await json(`${root}/browser/browser.json`);
const audit = await json(`${root}/audit.json`);
const integrity = await json(`${root}/integrity.json`);
const snapshot = await json(`${root}/source-snapshot.json`);
const text = await json(`${root}/text-review.json`);
const tap = await readFile(`${root}/tests.tap`, 'utf8');
const count = label => Number(tap.match(new RegExp(`^# ${label} (\\d+)$`, 'm'))?.[1]);
const sourceChanges = [];
for (const file of snapshot.files) {
  const actual = createHash('sha256').update(await readFile(file.path)).digest('hex');
  if (actual !== file.sha256) sourceChanges.push({ path: file.path, before: file.sha256, after: actual });
}
const artifactNames = await readdir(`${root}/browser`);
const artifacts = await Promise.all(artifactNames.filter(name => /\.(pdf|xlsx)$/.test(name)).map(async name => {
  const data = await readFile(`${root}/browser/${name}`);
  return { path: `browser/${name}`, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}));
const summary = {
  executedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  node: process.version, pnpm: execFileSync('pnpm.cmd', ['--version'], { encoding: 'utf8', shell: true }).trim(),
  sourceHashManifest: 'source-snapshot.json', sourceChangesSinceSnapshot: sourceChanges,
  commands: [
    { command: 'pnpm install --frozen-lockfile', exitCode: 0, evidence: 'install.log' },
    { command: 'pnpm build', exitCode: 0, evidence: 'build.log' },
    { command: 'pnpm exec tsx --test --test-reporter=tap tests/*.test.ts', exitCode: 0, evidence: 'tests.tap', note: 'Same test runner and test glob as pnpm test; explicit raw TAP reporter.' },
    { command: 'pnpm audit --prod --json', exitCode: 0, evidence: 'audit.json' },
    { command: "PHASE3_EVIDENCE=evidence/phase4/qa/browser pnpm run test:browser:phase3", exitCode: 0, evidence: 'browser.log' },
    { command: 'scripts/integrity.mjs evaluated with output path redirected to evidence/phase4/qa/integrity.json', exitCode: 0, evidence: 'integrity.log' }
  ],
  tests: Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(label => [label, count(label)])),
  productionAudit: audit.metadata,
  referenceIntegrity: { checked: integrity.checks.length, matched: integrity.checks.filter(check => check.match).length },
  browser: {
    engine: browser.engine, deviceScope: 'Desktop Microsoft Edge with emulated CSS viewport widths; no physical Android/iPhone/iPad device testing.',
    widths: [...new Set(browser.layouts.map(layout => layout.width))], checkpoints: browser.checks.length,
    layoutAssertions: browser.layouts.length, overflowFailures: browser.layouts.filter(layout => layout.scrollWidth > layout.width).length,
    uniquePngs: artifactNames.filter(name => /\.png$/.test(name)).length,
    downloadAssertions: browser.downloads.length, actualDownloadedFiles: artifacts.length,
    xlsxFiles: artifacts.filter(file => file.path.endsWith('.xlsx')).length,
    pdfFiles: artifacts.filter(file => file.path.endsWith('.pdf')).length,
    uncaughtErrors: browser.errors, usabilityScope: browser.usabilityScope,
    note: 'The followups screenshot is captured twice at each width under the same filename; layout assertion count exceeds unique screenshots by five.'
  },
  textReview: { sourceFiles: text.scannedFiles, invalidUtf8: text.invalidUtf8, replacementCharacters: text.replacementCharacters, mojibakeMarkers: text.mojibakeMarkers, exactWorkbookCells: text.unicodeWorkbookCells.filter(cell => cell.matches).length, pdfScope: text.visualReview.scope },
  downloadedArtifacts: artifacts,
};
await writeFile(`${root}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ tests: summary.tests, browser: summary.browser, sourceChanges }, null, 2));
if (summary.tests.fail || summary.browser.uncaughtErrors.length || summary.browser.overflowFailures || sourceChanges.length || summary.browser.checkpoints !== 26 || summary.browser.actualDownloadedFiles !== 35) process.exitCode = 1;
