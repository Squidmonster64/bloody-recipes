import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('Recipes brand lockup links to Bloody Dave’s Control', () => {
  assert.match(html, /class="brand-lockup family-control" href="https:\/\/control\.bloodydaves\.com"/);
  assert.match(html, /id="backBtn"/);
});

test('suite directory stays horizontal and includes Control plus in-app product tabs', () => {
  assert.match(html, /class="suite-directory"/);
  assert.match(html, /href="https:\/\/control\.bloodydaves\.com">Control</);
  assert.match(html, /id="mainTabs"/);
  assert.match(html, /data-view="library"/);
  assert.doesNotMatch(html, /id="backBtn"[^>]*href="https:\/\/control\.bloodydaves\.com"/);
});
