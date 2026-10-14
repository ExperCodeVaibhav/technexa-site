# Run the local site

Requires Node.js 22 or newer. No packages need to be installed.

```powershell
npm run dev
```

Open **http://localhost:3000**. Leave that terminal running; press Ctrl+C to stop it.
If port 3000 is already in use, stop the existing server or choose another port:

```powershell
$env:PORT = '3001'
npm run dev
```

This folder contains an HTTrack copy, not the original Astro source project.
`server.mjs` serves `lusion.co` as the web root, supports clean page URLs and
video byte ranges, and downloads missing static assets from `https://lusion.dev`
into `lusion.co/assets`. Internet access is needed the first time an uncached
asset is viewed. Cached assets are subsequently served from disk. The server
listens only on the local computer.

Vimeo embeds reject localhost, so Play links open the original Vimeo video in a
new tab. External project links use Technexa's published case studies.
Project inquiry forms open an email draft addressed to
`technexa@technexasolutions.in`; no mailing-list service is called.
Local visits do not load the production Google Analytics tag.

## Technexa content

Content was taken from `https://technexasolutions.in` on 10 October 2026.
`content/technexa-source.json` records the copied wording and source URLs.
The original styles, 3D scenes, reel, project media, hover effects, and page
transitions are retained. The animated wordmark geometry now reads TECHNEXA.
Small text-fitting adjustments accommodate the longer case-study heading and
FAQ copy. Existing project route/asset IDs are retained for animation compatibility;
the project grids show the four case studies published by Technexa.

Desktop/mobile rendering, menu navigation, case-study navigation, and asset
loading were checked in Chrome. Browser-check artifacts are in `.local/`.

## GitHub Pages

`npm run build:pages` creates the static `_site/` output for `/sitaram/`.
The build adapts absolute asset URLs and the animated client router to the
repository path, including direct page loads and refreshes. The local server
continues to serve the original root paths. No Node server is needed on Pages.

`.github/workflows/pages.yml` tests, builds, and publishes pushes to `main` once
GitHub Pages is enabled with **GitHub Actions** as its source. The repository
must be public or use a GitHub plan that supports Pages for private repositories.
The four linked case studies' desktop and mobile media are included locally.

## Hostinger

Create a root-domain-ready static build with:

```powershell
npm run build:hostinger
```

Upload the **contents** of `_hostinger/` to Hostinger's `public_html/` directory.
The generated `.htaccess` enables clean page URLs, compression, browser caching,
and directory-index handling on Hostinger's Apache/LiteSpeed hosting. The files
are already rooted for a custom domain, so do not use the GitHub Pages `_site/`
output for Hostinger.

## Portfolio CMS and inquiries

The public site keeps the original template and animation bundle intact. A small
enhancement layer in `lusion.co/assets/cms/` loads editable portfolio JSON,
adds image-backed cards for newly created projects, and connects the existing
contact actions to a project-inquiry form.

The admin interface lives at `/admin/`. It can add, edit, reorder, publish, and
unpublish portfolio entries. The inquiry inbox supports search, status filters,
reply links, CSV export, status updates, and permanent deletion. Unsaved portfolio
edits are tracked so reordering does not discard field changes.

Persistent JSON records are served by the separate Vercel Functions project in
`cms-api/` and stored in a private Vercel Blob store. Public portfolio reads and
contact submissions are allowed from GitHub Pages, the Technexa root/www domains,
and local port 3000. Portfolio writes and all inquiry-management endpoints require
the private admin key. The key is kept only in the browser tab's session storage.

### CMS API deployment setup

The API project requires Node.js 24, a private Vercel Blob store, and these
environment variables (see `cms-api/.env.example`):

- `ADMIN_KEY`: a unique value of at least 20 characters, stored as a Vercel Secret.
- `ALLOWED_ORIGINS`: comma-separated public site origins. Keep localhost entries
  only if the production API should accept local testing.
- Blob credentials: the existing project uses `BLOB_READ_WRITE_TOKEN`; newer
  private-store connections may inject `BLOB_STORE_ID` and use Vercel OIDC.
  These values are managed by the Blob connection and must never be committed.

Link and deploy from the API directory after authenticating the Vercel CLI:

```powershell
cd cms-api
npm install
vercel link --yes --project technexa-cms-api
vercel env pull .env.local --yes
vercel deploy --prod
```

Do not commit `.env.local`. After deployment, verify the public read endpoint with
an allowed `Origin` header and open `/admin/` on the deployed portfolio site. The
contact form preserves entered values on an API failure and offers a prefilled
email fallback instead of navigating away automatically.

If a clean mirror is restored, run `npm run cms:inject` once to reconnect the
enhancement stylesheet and module to all mirrored pages.

## Repairs and checks

- Repaired mirrored links and absolute client navigation, including browser history.
- Restored models, textures, audio, and project media through the local asset cache.
- Fixed interrupted media playback and stale project-image responses.
- Fixed the newsletter query string, video button labels, and invalid fallback CSS tokens.
- Added route, link, media-range, playback-race, and image-race regression checks.

```powershell
npm test
```

`scripts/repair-mirror.py` records the idempotent changes made to the downloaded
HTML and JavaScript. It can be rerun with Python if the same mirror is restored.
Runtime logs and browser-check artifacts from this repair are in `.local/`.
