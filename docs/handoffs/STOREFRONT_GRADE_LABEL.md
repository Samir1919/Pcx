# Handoff: storefront condition grade label

- Branch: main
- Scope: storefront rendered the raw server grade code (A_PLUS). Add a shared
  gradeLabel mapping and surface it on the card + passport.
- Acceptance: npm run verify passes; headed browser shows the listing card
  "A+" badge and passport "Grade A+" + "Health score 92" for a graded item.
- Changed: apps/web/lib/format.js (gradeLabel), ListingCard (grade badge),
  passport page (labeled grade).
- Decisions: label mapping only — server-owned grade codes stay untouched.
- Risks: none material.
- No blockers.
