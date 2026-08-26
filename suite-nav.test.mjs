import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('Recipes brand lockup links to Bloody Dave’s Control', () => {
  assert.match(html, /class="brand-lockup family-control" href="https:\/\/control\.bloodydaves\.com"/);
  assert.match(html, /id="backBtn"/);
});
