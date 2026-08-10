# Build Report

## Dataset confirmed

- Schema version: `5.0-final-review`
- Release status: `PENDING_USER_SIGNOFF`
- Declared recipe count: `41`
- Actual recipe count: `41`
- Unique IDs: `41`
- ID range: `BD-0001` to `BD-0041`
- Dataset favourites: `41`
- Markdown references found: `41`
- Optional archive included: `No`

## Structured content confirmed

| Coverage | Count |
|---|---:|
| Structured ingredients/method | 41 |
| Reference-only | 0 |
| Recipes with recorded total time | 39 |

All 41 curated recipes can now contribute structured ingredients to the combined shopping-list workflow.

## Automated checks

- JSON parses successfully.
- Recipe count and declared count agree.
- IDs are unique and use `BD-0001` format.
- All 41 Markdown paths exist.
- All 41 Markdown files are listed in the offline precache.
- All 41 dataset favourites are preserved.
- JavaScript and service-worker syntax checks pass.
- Ingredient parsing handles fractions, attached metric units, product-pack multipliers and quantity ranges.
- Pantry defaults to Have; shopping items default to Need.
- `Archive/index.json` remains optional.
- Service-worker cache bumped to `bd-recipes-v4` for dataset rollout.

## Dataset review flag

The supplied schema identifies the payload as `PENDING_USER_SIGNOFF`. The app preserves the supplied data unchanged; it does not silently alter source-derived recipe content.
