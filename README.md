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
new tab. External project links, Vimeo, and the newsletter use their original
online services. Newsletter delivery has not been tested with a real submission.
Local visits do not load the production Google Analytics tag.

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
