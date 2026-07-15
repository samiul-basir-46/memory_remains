# Project Structure

This project now uses a modular `src/` layout instead of a shared root-level stylesheet and script file.

## Folders

- `src/app/`
  - App bootstrap and page-level initialization.
- `src/components/`
  - Shared shell layout: header, footer, cart drawer, auth modal, upload modal.
- `src/config/`
  - Firebase and site-wide static configuration.
- `src/services/`
  - Firebase data flow, cart handling, Cloudinary-aware upload flow, checkout, library, profile, and page rendering logic.
- `src/styles/`
  - Design tokens, base rules, shell styles, and page styles.
- `src/utils/`
  - UI helpers and Cloudinary optimization helpers.
- `tools/`
  - Maintenance scripts such as Cloudinary cleanup.

## Cloudinary Optimization Strategy

- Upload images are compressed client-side before upload.
- The uploader prefers AVIF/WebP when supported.
- Image dimensions are capped before upload to reduce storage usage.
- Duplicate uploads are checked via a file signature before creating a new Cloudinary asset.
- Cloudinary delivery URLs use `f_auto`, `q_auto`, `dpr_auto`, and constrained widths.
- Cloudinary images are lazy-loaded and warmed into Cache Storage when viewed.
- Asset metadata is tracked in Firestore under `cloudinary_assets`.
- Unreferenced assets are queued into `cloudinary_cleanup_queue` for later deletion.

## Maintenance Notes

- Run `node tools/cloudinary-cleanup.mjs public_id_1 public_id_2` with Cloudinary credentials in environment variables to remove stale assets.
- Pages keep only page-specific content; shared layout lives in `src/components/site-shell.js`.
