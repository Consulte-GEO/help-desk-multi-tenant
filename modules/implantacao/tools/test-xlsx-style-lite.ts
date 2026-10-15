import assert from 'node:assert/strict';
import { write, utils, type WorkSheet } from '../frontend/src/vendor/xlsxStyleLite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function unzipStoredEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map<string, Uint8Array>();
  let offset = 0;

  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034B50) {
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    assert.equal(method, 0, 'o writer deve usar ZIP STORE');
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    entries.set(name, bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

const wb = utils.book_new();
const ws = utils.aoa_to_sheet([
  [
    { v: 'Cabeçalho', t: 's', s: { fill: { fgColor: { rgb: '182863' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'center' } } },
    { v: 'Valor', t: 's', s: { fill: { fgColor: { rgb: 'C5117E' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } } },
  ],
  ['Linha 1', { v: 12.5, t: 'n', s: { numFmt: '#,##0.00', border: { bottom: { style: 'thin', color: { rgb: 'D7D0C2' } } } } }],
  ['Linha 2', true],
]) as WorkSheet;
ws['!cols'] = [{ wch: 24 }, { wch: 14 }];
ws['!rows'] = [{ hpt: 24 }];
ws['!merges'] = [{ s: { r: 3, c: 0 }, e: { r: 3, c: 1 } }];
ws['A4'] = { v: 'Mesclado', t: 's', s: { fill: { fgColor: { rgb: 'F7F6F2' } } } };
ws['!ref'] = 'A1:B4';
ws['!autofilter'] = { ref: 'A1:B3' };
ws['!freeze'] = { ySplit: 1 };
ws['!views'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }];
utils.book_append_sheet(wb, ws, 'Estilos');
utils.book_append_sheet(wb, utils.aoa_to_sheet([['Segunda aba'], ['áéíóú & < >']]), 'Dados');
wb.Workbook = { Views: [{ activeTab: 1 }] };

const bytes = write(wb, { type: 'array', bookType: 'xlsx' });
assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true), 0x04034B50);
const entries = unzipStoredEntries(bytes);
for (const required of [
  '[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml',
  'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
  'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
]) assert.ok(entries.has(required), `entrada ausente: ${required}`);

const decoder = new TextDecoder();
const styles = decoder.decode(entries.get('xl/styles.xml'));
const sheet1 = decoder.decode(entries.get('xl/worksheets/sheet1.xml'));
const workbook = decoder.decode(entries.get('xl/workbook.xml'));
assert.match(styles, /patternType="solid"/);
assert.match(styles, /<b\/>/);
assert.match(styles, /numFmtId="164"/);
assert.match(sheet1, /<mergeCell ref="A4:B4"\/>/);
assert.match(sheet1, /<autoFilter ref="A1:B3"\/>/);
assert.match(sheet1, /state="frozen"/);
assert.match(sheet1, /<v>12\.5<\/v>/);
assert.match(workbook, /activeTab="1"/);
assert.match(workbook, /name="Estilos"/);
assert.match(workbook, /name="Dados"/);

const output = process.argv[2] || '.v8-validation/xlsx-style-lite-selftest.xlsx';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, bytes);
console.log(JSON.stringify({ ok: true, output, bytes: bytes.length, entries: entries.size, sheets: wb.SheetNames }, null, 2));
