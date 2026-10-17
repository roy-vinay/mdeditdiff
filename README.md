# mdEditDiff product website

A static, responsive GitHub Pages site for mdEditDiff. No dependencies, tracking, external fonts, or build step.

## Local preview

Run `python3 -m http.server 4173` from this directory and open `http://localhost:4173`.

## Publish

Publish this directory as the root of `roy-vinay/mdeditdiff`. Under Settings → Pages, choose **Deploy from a branch**, branch **main**, folder **/(root)**. The intended URL is https://roy-vinay.github.io/mdeditdiff/.

The product source and releases remain at https://github.com/roy-vinay/applied-ai-agents/tree/main/tools/mdeditdiff. This repository holds the website only.

## Live demos

The demos (`demo/app.html?scenario=kinetic` in the hero, `demo/app.html?scenario=review` in the review section, and the guided tour at plain `demo/app.html`) run the Mac app's real preview code, copied unchanged into `demo/engine/` from the release named in `demo/engine/VERSION`. Around it, `demo/app.js` plays the part of the app: the toolbar, the editor, the history the command-line tool would keep, two agents editing the file, and a guided tour that only plays while the demo is on screen and stops when a visitor takes over. `demo/engine/preview.html` and `bridge.js` are the only demo-specific engine files.

The demos need to be served over HTTP (as GitHub Pages does) because the demo window talks to the preview frame directly; opening `index.html` from disk won't run them.

## Maintenance

When promoting a new release, update the visible version, download URLs, installation command and feature status together, then refresh the demo engine:

```
scripts/sync-engine.sh mdeditdiff-v0.5.3   # or no argument for the latest release
```

If a release changes the preview's messages or functions, adjust `demo/app.js` to match and check every tour step. Screenshots were copied from the public product repository.

Use relative asset links to support project-path hosting. The icon, screenshots and the files in `demo/engine/` are from the MIT-licensed mdEditDiff project (markdown-it's license is in `demo/engine/THIRD_PARTY_LICENSES.txt`). Page source is also provided under MIT.
