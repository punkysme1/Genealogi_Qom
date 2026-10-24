import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderUpdates, usesSeparateOrder } from '../src/lib/child-order-form';

test('shared default also fills a parent selected after typing the order', () => {
  const form = { father_id: 'f', mother_id: 'm', order_drafts: { f: '2' } };
  assert.equal(usesSeparateOrder(form), false);
  assert.deepEqual(orderUpdates(form), [['f', '2'], ['m', '2']]);
});
test('mother-only entries work and removed parents are excluded', () => {
  assert.deepEqual(orderUpdates({ mother_id: 'm', order_drafts: { f: '3', m: '2' } }), [['m', '2']]);
});
test('existing unequal orders reopen separately and remain unchanged', () => {
  const form = { father_id: 'f', mother_id: 'm', child_order: {
    f: { position: 2, source: 'K', locator: '1' }, m: { position: 1, source: 'K', locator: '1' }
  } };
  assert.equal(usesSeparateOrder(form), true);
  assert.deepEqual(orderUpdates(form), []);
  assert.deepEqual(orderUpdates({ ...form, separate_order: false }), [['m', '2']]);
  assert.deepEqual(orderUpdates({ ...form, order_drafts: { m: '' } }), [['m', '']]);
});
test('unknown orders stay empty and separate edits remain independent', () => {
  assert.deepEqual(orderUpdates({ father_id: 'f', mother_id: 'm' }), []);
  assert.deepEqual(orderUpdates({ father_id: 'f', mother_id: 'm', separate_order: true,
    order_drafts: { f: '4', m: '2' } }), [['f', '4'], ['m', '2']]);
});
