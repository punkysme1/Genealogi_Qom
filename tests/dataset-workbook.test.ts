import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createDatasetWorkbook, parseDatasetWorkbook, validateDataset, type ImportData } from '../src/lib/dataset-workbook';
import type { Individual, Marriage } from '../src/types';
const p = (id: string, fields = {}): Individual => ({ id, name: 'Nama contoh', gender: 'M', is_verified: false, created_at: '', updated_at: '', ...fields });
const arrayBuffer = (b: any) => new Uint8Array(b).buffer;
test('Excel roundtrip preserves metadata and relationships without exposing UUID or slug', async () => {
  const people = [p('uuid-father', { birth_date: '1800-01-01', aliases: ['Bapak'], is_alive: false }), p('uuid-mother', { gender: 'F', is_alive: null }), p('uuid-child', { father_id: 'uuid-father', mother_id: 'uuid-mother', bio: '=1+1' })];
  const marriages: Marriage[] = [{ id: 'private-marriage-id', husband_id: people[0].id, wife_id: people[1].id, is_active: null, created_at: '' }];
  const buffer = await createDatasetWorkbook(people, marriages);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  assert.doesNotMatch(JSON.stringify(wb.getWorksheet('Individu')!.getSheetValues()), /uuid|slug/i);
  const parsed = await parseDatasetWorkbook(arrayBuffer(buffer));
  assert.equal(parsed.people[2].father, '1'); assert.equal(parsed.people[2].mother, '2');
  assert.equal(parsed.people[0].birth_date, '1800-01-01'); assert.deepEqual(parsed.people[0].aliases, ['Bapak']);
  assert.equal(parsed.people[1].is_alive, null); assert.equal(parsed.marriages[0].is_active, null);
  assert.equal(parsed.people[2].bio, '=1+1');
});
test('reject duplicate keys, missing parents, self marriage and ancestry cycles', async () => {
  const original = await parseDatasetWorkbook(arrayBuffer(await createDatasetWorkbook([p('a'), p('b')])));
  const copy = () => structuredClone(original);
  let data = copy(); data.people[1].key = '1'; assert.throws(() => validateDataset(data), /berulang/);
  data = copy(); data.people[0].father = 'missing'; assert.throws(() => validateDataset(data), /tidak valid/);
  data = copy(); data.people[0].father = '2'; data.people[1].father = '1'; assert.throws(() => validateDataset(data), /siklus/);
  data = copy(); data.marriages = [{ key: '1', husband: '1', wife: '1', marriage_date: null, is_active: true }]; assert.throws(() => validateDataset(data), /pasangan tidak valid/);
});
test('a template has no fake people and requires both sheets and exact headers', async () => {
  const buffer = await createDatasetWorkbook();
  await assert.rejects(parseDatasetWorkbook(arrayBuffer(buffer)), /minimal satu/);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer); wb.getWorksheet('Individu')!.getCell('A1').value = 'UUID';
  await assert.rejects(parseDatasetWorkbook(arrayBuffer(await wb.xlsx.writeBuffer())), /ID Individu/);
});
test('spreadsheet formulas and invalid calendar dates are rejected with cell context', async () => {
  const buffer = await createDatasetWorkbook([p('a')]);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  wb.getWorksheet('Individu')!.getCell('B2').value = { formula: '1+1', result: 2 };
  await assert.rejects(parseDatasetWorkbook(arrayBuffer(await wb.xlsx.writeBuffer())), /baris 2.*rumus/);
  wb.getWorksheet('Individu')!.getCell('B2').value = 'A'; wb.getWorksheet('Individu')!.getCell('G2').value = '2026-02-30';
  await assert.rejects(parseDatasetWorkbook(arrayBuffer(await wb.xlsx.writeBuffer())), /tanggal harus/);
});
test('unknown names remain separate records and generate a review warning', async () => {
  const result = await parseDatasetWorkbook(arrayBuffer(await createDatasetWorkbook([p('a', { name: '' }), p('b', { name: '' })])));
  assert.equal(result.people.length, 2); assert.match(result.warnings[0], /2 individu tanpa nama/);
});
