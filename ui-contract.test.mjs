import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const root = new URL('./', import.meta.url);
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
const payload = JSON.parse(readFileSync(new URL('./recipes.json', import.meta.url), 'utf8'));
const studioHtml = readFileSync(new URL('./generator/app/templates/studio.html', import.meta.url), 'utf8');
const railway = readFileSync(new URL('./generator/railway.studio.json', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('./Dockerfile.studio', import.meta.url), 'utf8');

test('dark natural theme, not 5M paper/red', () => {
  assert.match(css, /--bg:\s*#121714/);
  assert.match(css, /--ink:\s*#f6f1e6/);
  assert.match(css, /--sand:\s*#d8b47a/);
  assert.match(css, /--orange:\s*#d87b36/);
  assert.match(html, /theme-color" content="#121714"/);
  assert.equal(manifest.theme_color, '#121714');
  assert.equal(manifest.background_color, '#121714');
  assert.doesNotMatch(css, /--paper:#fbf8f2/);
  assert.doesNotMatch(css, /--red:#8f1d18/);
  assert.doesNotMatch(html, /theme-color" content="#8f1d18"/);
});

test('Control return stays on the family mark; backBtn stays in-product', () => {
  assert.match(html, /id="backBtn"/);
  assert.match(html, /class="brand-lockup family-control" href="https:\/\/control\.bloodydaves\.com"/);
  assert.match(html, /suite-directory[\s\S]*href="https:\/\/control\.bloodydaves\.com"/);
  assert.match(html, /id="studioLink"[^>]*href="https:\/\/studio\.recipes\.bloodydaves\.com"/);
  const backIndex = html.indexOf('id="backBtn"');
  const lockupIndex = html.indexOf('class="brand-lockup family-control"');
  assert.ok(backIndex > 0 && lockupIndex > backIndex);
});

test('compact horizontal suite chrome, no left rail or marketing hero', () => {
  assert.match(html, /class="suite-directory"/);
  assert.match(html, /class="tabs product-nav"/);
  assert.doesNotMatch(html, /class="(left-rail|sidebar|app-rail)"/);
  assert.doesNotMatch(css, /grid-template-columns:\s*(240px|280px|320px)\s+1fr/);
  assert.match(css, /\.suite-directory\{[^}]*display:flex/);
  assert.match(css, /--header-h:48px/);
  assert.match(css, /h1\{margin:0;font-size:1\.05rem/);
  assert.match(css, /\.detail-title-row h2\{font-size:1\.2rem/);
  assert.match(css, /\.detail-hero\{[^}]*max-height:168px/);
  assert.match(css, /\.recipe-card\{display:grid;grid-template-columns:var\(--thumb\)/);
  assert.match(css, /--thumb:88px/);
});

test('mandatory viewports are named and 1024x768 is overflow-safe', () => {
  assert.match(css, /Viewport contract: 390x844, 768x1024, 1024x768, 820x1180, 1180x820, 1440x900/);
  assert.match(css, /@media\(min-width:760px\)/);
  assert.match(css, /@media\(min-width:1024px\)/);
  assert.match(css, /@media\(min-width:1180px\)/);
  assert.match(css, /@media\(min-width:1440px\)/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /html\{scroll-behavior:smooth;overflow-x:clip/);
  assert.match(css, /@media\(min-width:1024px\)\{[\s\S]*html\{overflow-x:clip\}/);
  assert.match(css, /\.week-plan-grid\{[^}]*overflow-x:auto;max-width:100%/);
  assert.match(css, /@media\(min-width:760px\)\{[\s\S]*week-plan-grid\{grid-template-columns:repeat\(7,minmax\(0,1fr\)\)\}/);
});

test('public catalogue, cards, heroes and PWA cache remain intact', () => {
  const recipes = payload.recipes;
  assert.equal(recipes.length, 41);
  assert.equal(payload.recipe_count, 41);
  const ids = recipes.map(recipe => recipe.id);
  assert.deepEqual(ids, Array.from({ length: 41 }, (_, index) => `BD-${String(index + 1).padStart(4, '0')}`));
  for (const recipe of recipes) {
    assert.ok(recipe.title);
    assert.equal(existsSync(new URL(recipe.reference_file, root)), true, recipe.reference_file);
    assert.equal(existsSync(new URL(`./assets/hero/${recipe.id}.jpg`, root)), true, recipe.id);
    assert.equal(existsSync(new URL(`./cards/${recipe.id}.pdf`, root)), true, recipe.id);
  }
  assert.match(sw, /const CACHE = 'bd-recipes-v12'/);
  assert.match(sw, /assets\/bloody_dave_logo\.png/);
  assert.match(sw, /recipes\.json/);
  assert.match(html, /id="libraryView"/);
  assert.match(html, /id="savedView"/);
  assert.match(html, /id="librarySearch"/);
  assert.match(html, /id="recipeDetail"/);
});

test('Recipe Studio publication contract and Railway configs are untouched', () => {
  assert.match(studioHtml, /BLOODY DAVE'S — RECIPE STUDIO/);
  assert.match(studioHtml, /Publish recipe/);
  assert.match(railway, /dockerfilePath": "\/Dockerfile\.studio"/);
  assert.match(dockerfile, /COPY generator \/app\/generator/);
  assert.match(dockerfile, /"uvicorn", "app.main:app"/);
  const generatorFiles = readdirSync(new URL('./generator/app', import.meta.url));
  for (const name of ['main.py', 'github_publish.py', 'jobs.py', 'card_renderer.py', 'qa.py']) {
    assert.ok(generatorFiles.includes(name), name);
  }
});
