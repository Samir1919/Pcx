# Handoff: ecommerce product detail view on storefront passport

- Branch: main
- Scope: passport page now shows a large main image with a thumbnail gallery (click to swap) and full model specifications, instead of a flat thumbnail grid and a link to the separate model page.
- Acceptance: npm run verify passes (588 tests, 0 fail); headed browser shows main image + thumbnail gallery + specifications table (Wattage -> 650 W).
- Changed: listing repo/service (listModelSpecifications + publicPassport returns full specs), web format.js (specValue), passport page (gallery + specs), globals.css (.gallery*), listing-service test, AGENTS.md (industry-standard rule).
- Decisions: passport embeds full model specs (same rows the model page shows); mediaIds drives the gallery with the first image as the main.
- Risks: none material.
- No blockers.
