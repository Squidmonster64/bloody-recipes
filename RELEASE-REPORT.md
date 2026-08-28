# Recipes Suite UI Recovery — release report

Lane: existing PR `cursor/suite-nav-control-2e8b` (do not merge).
Base: current `main` including Recipe Studio under `generator/`.

## Head

Recorded after the UI recovery commit. Confirm with `git rev-parse HEAD` on this branch.

## Scope

Public Recipes PWA chrome and layout only:

- Rebased the Control lockup commit onto current `main`.
- Kept Recipe Studio header link from production.
- Replaced the 5M paper/red public theme with Bloody Dave’s dark natural shell (sand/orange accents, light text).
- Compact search, compact recipe rows, information-dense detail, horizontal suite/product nav.
- Persistent Control return on the family mark; `#backBtn` remains in-product Back.
- Added deterministic UI/nav contract tests.

## Preserved

- 41 curated recipes, IDs `BD-0001`–`BD-0041`, titles/text, Markdown references
- Hero images and printable cards
- Saved recipes / Pocket Cookbook import, local week plan, shopping Have/Need, Get List hand-off
- PWA manifest + service worker (cache bumped to `bd-recipes-v11`)
- QR/card PDF links on recipe detail
- Recipe Studio backend/generator behaviour, publication contract, Railway Docker configs

## Tests

See the PR body / later section for the executed command log. Public-app checks:

```bash
python3 scripts/validate_data.py
python3 scripts/rebuild_recipe_index.py
node --check app.js
node --check sw.js
node tests/test_data_logic.js
python3 tests/test_static_files.py
node --test suite-nav.test.mjs ui-contract.test.mjs
python3 -m pytest generator/tests -q
```

## Viewports

CSS contract names: 390×844, 768×1024, 1024×768, 820×1180, 1180×820, 1440×900.
1024×768 is treated as old-iPad release-critical: page `overflow-x: clip`, week grid `minmax(0,1fr)`, compact chrome.

## Screenshots

Browser captures at 1024×768 and 390×844 for library and recipe detail are attached to the agent walkthrough after manual verification.

## Not merged

This branch stops at the new head SHA. Merge remains a human decision.
