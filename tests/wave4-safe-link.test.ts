import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeLink } from '../src/lib/nasab-contract';

test('SEC-09: safeLink allows http/https URLs and rejects javascript:, data:, vbscript:, credentials, and non-URLs', () => {
  assert.equal(safeLink('https://turots.qomaruddin.com/katalog/123'), 'https://turots.qomaruddin.com/katalog/123');
  assert.equal(safeLink('  http://arsip.naracode.id/doc/1  '), 'http://arsip.naracode.id/doc/1');
  assert.equal(safeLink('javascript:alert(1)'), undefined);
  assert.equal(safeLink('JAVASCRIPT:alert(document.cookie)'), undefined);
  assert.equal(safeLink('data:text/html,<script>alert(1)</script>'), undefined);
  assert.equal(safeLink('vbscript:msgbox(1)'), undefined);
  assert.equal(safeLink('https://user:pass@example.com/'), undefined);
  assert.equal(safeLink('Manuskrip Qomaruddin hlm. 12'), undefined);
  assert.equal(safeLink(''), undefined);
  assert.equal(safeLink(null), undefined);
});

test('SEC-09: IndividualDetail.tsx wraps verification_source with safeLink', () => {
  const detailSrc = readFileSync('src/components/Sidebar/IndividualDetail.tsx', 'utf8');
  assert.match(detailSrc, /safeLink\(individual\.verification_source\)/);
  assert.doesNotMatch(detailSrc, /href=\{individual\.verification_source\}/);
});
