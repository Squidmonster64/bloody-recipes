# Recipes Suite UI Recovery — release report

**Do not merge.** Human review stop-state.

- Branch: `cursor/suite-nav-control-2e8b`
- PR: https://github.com/Squidmonster64/bloody-recipes/pull/3
- Base: `main` @ `8eb1935` (Recipe Studio under `generator/`, Railway Docker fix)

## Head SHA

Fill after the recovery commits land; also in the PR body.

## What landed

1. Rebased the existing Control lockup commit onto current production `main`.
2. Kept the production Recipe Studio header link (`#studioLink` → studio.recipes.bloodydaves.com).
3. Public PWA restyle only:
   - Dark natural shell `#121714` / `#1d251f`, light text `#f6f1e6`, sand `#d8b47a`, orange `#d87b36`
   - Removed 5M paper/red (`#fbf8f2` / `#8f1d18`) from public chrome, manifest, and theme-color
   - Compact header + horizontal suite/product nav (Control included); no left rail
   - Compact search and recipe **rows** (76–96px thumbs)
   - Information-dense detail (hero 140–240px, two-column ingredients/method from 760px)
   - Family mark `.brand-lockup.family-control` → https://control.bloodydaves.com
   - `#backBtn` remains in-product Back
4. Deterministic contracts: `suite-nav.test.mjs`, `ui-contract.test.mjs`
5. Service worker cache `bd-recipes-v12`

## Preserved (untouched behaviour)

- 41 recipes, IDs `BD-0001`–`BD-0041`, titles/text, Markdown references
- `assets/hero/*.jpg` and `cards/*.pdf`
- Saved recipes / Pocket Cookbook, week plan, shopping Have/Need, Get List hand-off
- PWA install + offline SW (cache name bumped only)
- Printable card / QR PDF links on detail
- `generator/` app behaviour, publication contract, `Dockerfile.studio`, `generator/railway.studio.json`

## Tests run

```text
python3 scripts/validate_data.py
  OK: 41 curated recipes; IDs and Markdown references are valid.
  OK: 41 dataset favourites preserved.

python3 scripts/rebuild_recipe_index.py
  OK: wrote docs/Recipe Index.md with 41 recipes. (no git diff)

node --check app.js
node --check sw.js
node tests/test_data_logic.js
  OK: data normalisation, favourites, time parsing, search and ingredient merging.

python3 tests/test_static_files.py
  OK: application shell, 41 Markdown/hero/card assets, scalable offline cache and optional archive structure.

node --test suite-nav.test.mjs ui-contract.test.mjs
  8 passed

python3 -m pytest generator/tests -q
  10 passed in 0.69s
```

Generator tests were executed to confirm they still pass. No generator test or backend files were changed.

## Viewport contract (measured, overflowX = 0)

| Viewport | Library overflowX | Detail overflowX | Thumb (px) | Hero (px) |
|---|---:|---:|---:|---:|
| 390×844 | 0 | 0 | 76 | 140 |
| 768×1024 | 0 | 0 | 88 | 168 |
| **1024×768** | **0** | **0** | 96 | 200 |
| 820×1180 | 0 | 0 | 88 | 168 |
| 1180×820 | 0 | 0 | 96 | 200 |
| 1440×900 | 0 | 0 | 96 | 240 |

Background `rgb(18, 23, 20)`, text `rgb(246, 241, 230)`, 41 cards, Control lockup present, no left rail.

## Browser evidence

- `recipes_library_1024x768.png` / `recipes_detail_1024x768.png`
- `recipes_library_390x844.png` / `recipes_detail_390x844.png`
- Walkthrough: library → barramundi search → BD-0001 detail → in-app Back → Shopping → Library

## Figma

https://www.figma.com/design/1pUZDEIUcBbiRrYbkrR9Pu page `11 — Recipes + Pantry + Get List` was cited as authority. The file was not fetchable from this environment (CloudFront 403), so implementation followed the written recovery brief plus the existing suite chrome tokens (`#1d251f` / `#d8b47a` / `#d87b36`).
