# Handoff: seller photo pick-and-promote → storefront

- Branch: main
- Scope: seller photos were PRIVATE and locked to the sell request, so they
  never reached the listing/storefront. Add an admin pick-and-promote flow.
- Acceptance: npm run verify passes (586 tests, 0 fail); headed browser:
  admin -> listings -> Photos modal -> SELLER PHOTOS -> "Use for listing"
  -> POST /api/v1/admin/listings/:id/media/promote (201) -> "Added ✓"
  -> storefront card <img> + passport gallery render the promoted image;
  public media served as image/webp (200).
- Changed: media service/repo/http (promoteSellerPhoto, listSellerMediaForListing,
  findListingSellRequestId, updateVisibility), local-media-storage promote(),
  listing repo/service (media_ids / cover_media_id in public passport + search),
  domain createPublicListing/createPublicPassport (coverMediaId / mediaIds),
  admin listing-api + Photos modal seller picker, storefront mediaUrl + ListingCard
  + passport page + globals.css (.cardMedia), tests.
- Decisions: promote FLIPS the same media row PRIVATE->PUBLIC and links it to
  listing_media (storage key unchanged) so the media.storage_key UNIQUE
  constraint is never violated; no new media row, no copy. The seller's photo
  becomes public only when an admin explicitly promotes it (pick & promote).
- Risks: none material. Flipping visibility means the same photo is also public
  on the seller's own sell-request view; acceptable for item photos (not serials
  or private evidence).
- No blockers.

Note: the dev API container (node --watch) did not reliably detect edits to
media-service.mjs / local-media-storage.mjs during verification; `docker restart
infra-api-1` was used to load the latest code. Watch still detected the repo/
service/domain files. Worth confirming the watch glob if it recurs.
