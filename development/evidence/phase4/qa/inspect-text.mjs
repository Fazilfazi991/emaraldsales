import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';

const output = 'evidence/phase4/qa';
const files = [];
async function walk(root) {
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = `${root}/${item.name}`;
    if (item.isDirectory()) await walk(path);
    else if (/\.(?:ts|js|mjs|css|html)$/.test(path)) files.push(path);
  }
}
for (const root of ['src', 'scripts', 'tests']) await walk(root);
const invalidUtf8 = [], replacementCharacters = [], mojibakeMarkers = [];
for (const path of files) {
  const bytes = await readFile(path);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { invalidUtf8.push(path); continue; }
  if (text.includes('\uFFFD')) replacementCharacters.push(path);
  if (/[\u00C3\u00C2]|\u00E2\u20AC|\u00F0\u0178/.test(text)) mojibakeMarkers.push(path);
}
const path = 'evidence/phase3/reports/unicode-activity.xlsx';
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(path);
const report = workbook.getWorksheet('Report');
const expected = [
  ['أحمد حسن', 'النور لمواد البناء (دبي) - Al Noor 123', 'Customer requested cement prices. اتصل غداً الساعة 10:30'],
  ['നസീർ മുഹമ്മദ്', 'മലബാർ ബിൽഡിംഗ് മെറ്റീരിയൽസ്', 'Customer requested a quotation. നാളെ വിളിക്കുക. സ്റ്റോക്ക് ലഭ്യമാണ്.'],
  ['Élodie D’Souza', 'D’Souza Tools – Démo', 'Crème, façade, São João, İstanbul, Łódź. =HYPERLINK remains plain text.'],
];
const cells = expected.flatMap((row, r) => row.map((value, c) => ({ cell: report.getCell(r + 6, c + 1).address, matches: report.getCell(r + 6, c + 1).value === value })));
const samplePaths = ['evidence/phase3/reports/unicode-activity.pdf', 'evidence/phase3/reports/unicode-multipage.pdf', path];
const samples = await Promise.all(samplePaths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
const result = {
  executedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceFileHashes: Object.fromEntries(await Promise.all(['src/report-downloads.ts', 'src/pdf-report.ts', 'scripts/phase3-report-samples.ts'].map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')]))),
  scannedFiles: files.length, invalidUtf8, replacementCharacters, mojibakeMarkers,
  retainedPhase3Samples: samples, unicodeWorkbookCells: cells,
  visualReview: { scope: 'Retained Phase 3 synthetic samples, rendered read-only with Poppler into Phase 4 QA images. This is not a new actual-runtime download.', pagesInspected: ['unicode-activity page 1', 'unicode-multipage page 1'], finding: 'Arabic and Malayalam glyphs present with shaping; mixed Latin/numeric context visible. No replacement boxes, clipped cells, or overlap observed in inspected pages. Native-language client acceptance remains pending.' }
};
await writeFile(`${output}/text-review.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (invalidUtf8.length || replacementCharacters.length || mojibakeMarkers.length || cells.some(cell => !cell.matches)) process.exitCode = 1;
