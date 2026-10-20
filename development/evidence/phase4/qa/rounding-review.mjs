import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { Reports } from '../../../src/reports.ts';

// Read-only call to the actual implementation. These timings are illustrative,
// not timings recovered from the operational database or observed exports.
const base = Date.parse('2026-10-20T10:00:00Z');
const reports = new Reports({});
const filters = { start: '2026-10-19T20:00:00Z', end: '2026-10-20T20:00:00Z', asOf: '2026-10-20T11:00:00Z' };
const illustrative = [[10520, 240], [11120, 240], [16800, 0]].map(([elapsedMs, restMs]) => {
  const row = { started_at: new Date(base), ended_at: new Date(base + elapsedMs), rests: restMs ? [{ started_at: new Date(base + 1000), ended_at: new Date(base + 1000 + restMs) }] : [] };
  const actualMethod = reports.dutyDurations(row, filters);
  return { illustrativeOnly: true, elapsedMs, restMs, activeMs: elapsedMs - restMs, actualMethod };
});
const sum = key => Math.round(illustrative.reduce((n, row) => n + row.actualMethod[key], 0) * 100) / 100;
const book = new ExcelJS.Workbook();
const xlsxPath = 'evidence/phase4/runtime/selected-staff-duty.xlsx';
await book.xlsx.readFile(xlsxPath);
const sheet = book.getWorksheet('Report');
const breaks = book.getWorksheet('Break history');
const dutyRows = [];
for (let row = 6; row <= sheet.rowCount; row++) dutyRows.push({ state: sheet.getCell(row, 4).value, displayedElapsedMinutes: sheet.getCell(row, 5).value, displayedRestMinutes: sheet.getCell(row, 6).value, displayedActiveMinutes: sheet.getCell(row, 7).value, breakHistorySummary: sheet.getCell(row, 8).value });
const actualBreakRows = [];
for (let row = 2; row <= breaks.rowCount; row++) actualBreakRows.push({ executive: breaks.getCell(row, 1).text, dutyStartedUae: breaks.getCell(row, 2).text, breakStartedUae: breaks.getCell(row, 3).text, returnedUae: breaks.getCell(row, 4).text });
const paths = ['src/reports.ts', 'src/pdf-report.ts', xlsxPath, 'evidence/phase4/runtime/selected-staff-duty.pdf', 'evidence/phase4/runtime/selected-staff-duty.png', 'evidence/phase4/runtime/all-staff-activity.pdf', 'evidence/phase4/runtime/all-staff-activity.png'];
const hashes = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const result = {
  executedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), hashes,
  classification: { priority: 'P3', kind: 'Presentation rounding acceptance observation', integrityFailureReproduced: false },
  sourceBehavior: 'Reports.dutyDurations unions/clips raw millisecond intervals, subtracts raw rest from elapsed, then independently rounds elapsed/rest/active to 0.01 minutes. Reports.exportRows sums those rounded row metrics for each total.',
  illustrativeActualMethodReproduction: illustrative,
  illustrativeDisplayedTotals: { elapsedMinutes: sum('elapsed_minutes'), restMinutes: sum('rest_minutes'), activeMinutes: sum('active_minutes') },
  rawVersusDisplay: { restZeroDisplayThreshold: 'Positive rest below 300 ms rounds to 0 minutes at 0.01-minute precision. Raw subtraction can still move rounded active time down 0.01 minute.', actualRawDatabaseIntervalsRead: false, note: 'The example raw timings are constructed only. Actual exported break timestamps have minute precision and cannot establish actual subsecond rest durations.' },
  observedRuntimeXlsx: { path: xlsxPath, workbookCreatedAt: book.created?.toISOString(), totals: sheet.getCell('A4').text, rows: dutyRows, actualBreakRowCount: actualBreakRows.length, actualBreakRows, finding: 'Both ended-session break records remain represented in the actual Break history worksheet.' },
  observedRuntimePdf: { path: 'evidence/phase4/runtime/selected-staff-duty.pdf', reviewImage: 'evidence/phase4/runtime/selected-staff-duty.png', visuallyObservedTotals: { elapsedMinutes: 0.65, restMinutes: 0, activeMinutes: 0.63 }, visuallyObservedRows: [{ state: 'On duty', elapsedMinutes: 0.28, restMinutes: 0, activeMinutes: 0.28 }, { state: 'Ended', elapsedMinutes: 0.18, restMinutes: 0, activeMinutes: 0.17 }, { state: 'Ended', elapsedMinutes: 0.19, restMinutes: 0, activeMinutes: 0.18 }] },
  independentExportSnapshots: { xlsxOngoingMinutes: dutyRows.find(row => row.state === 'On duty')?.displayedElapsedMinutes, pdfOngoingMinutes: 0.28, finding: 'XLSX has 0.27 ongoing minutes while PDF has 0.28. Each download calls Reports.filters with its own clock/asOf and read-only repeatable-read transaction. The elapsed ongoing session advances between sequential exports; identical minute-formatted context does not imply an identical instant. The 0.01 total difference is consistent with those independent snapshots.' },
  freshRuntimeMultilingualPdfReview: { path: 'evidence/phase4/runtime/all-staff-activity.pdf', reviewImage: 'evidence/phase4/runtime/all-staff-activity.png', pagesInspected: [1], runtimeSource: 'Fresh runtime all-staff activity download, separate from retained Phase 3 samples.', finding: 'Arabic and Malayalam names/shop labels and accented Latin render visibly with shaped glyphs; no missing-glyph boxes, clipped text or overlap observed on the inspected single page.', limit: 'Visual engineering review only; native-language client acceptance remains pending.' },
  recommendedDisposition: 'Record as a P3 owner acceptance observation. Preserve raw duration arithmetic and records. A future small presentation clarification can state that each metric is independently rounded to 0.01 minute, totals sum rounded rows, and subsecond rests may display zero. Do not recompute net from already-rounded duty/rest or invent payroll/minimum-break rules.',
  changes: 'Only QA documentation/evidence written; no app edits, database reads/writes or business-rule changes.'
};
await writeFile('evidence/phase4/qa/rounding-review.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ classification: result.classification, illustrativeTotals: result.illustrativeDisplayedTotals, actualBreakRows: actualBreakRows.length, xlsxOngoingMinutes: result.independentExportSnapshots.xlsxOngoingMinutes }, null, 2));
if (sum('elapsed_minutes') !== 0.65 || sum('rest_minutes') !== 0 || sum('active_minutes') !== 0.63 || actualBreakRows.length !== 2) process.exitCode = 1;
