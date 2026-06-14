# Releasing & auto-update

The app updates itself from **GitHub Releases** using `electron-updater` (the
`github` provider configured in `package.json > build > publish`). When an update
is published, installed apps show an **update button** in the title bar — it
downloads in the background, then "Restart to update" installs it.

Builds run on **Codemagic** (free cloud Mac + Windows machines), not GitHub
Actions. Codemagic builds the installers and publishes them — plus the
`latest.yml` / `latest-mac.yml` update manifests — straight to a GitHub Release.

## One-time setup

In the Codemagic UI (App settings → Environment variables) add:

- `GH_TOKEN` — a GitHub personal access token with `repo` scope, marked **Secret**.
  electron-builder uses it to upload artifacts to the GitHub Release.

## Cutting a release

1. Bump the version in `package.json` (e.g. `npm version patch`) and push.
2. In Codemagic, run the **macOS** and **Windows** workflows. Each one:
   - installs deps, builds the renderer,
   - downloads the bundled Ollama binary (`scripts/download-ollama.mjs`),
   - builds the installer and publishes it + the update manifest to a **draft**
     GitHub Release for the current version (both jobs append to the same draft).
3. On GitHub, **publish the draft release**.
4. Existing users get the update automatically within ~6 hours, or on next launch.

## Platform notes

- **Windows** — auto-update works out of the box. The unsigned installer shows a
  SmartScreen warning ("More info → Run anyway") until a code-signing cert is added
  (Azure Trusted Signing is ~$10/mo, or a standard OV/EV cert).
- **macOS** — the build (DMG/zip) works, but **auto-update only works if the app is
  signed + notarized** with an Apple Developer account ($99/yr). Until then, Mac
  users download new versions manually and open via right-click → Open the first
  time. To enable signing later, add these Codemagic env vars and remove the
  `CSC_IDENTITY_AUTO_DISCOVERY: "false"` line from `codemagic.yaml`:
  `CSC_LINK` (base64 .p12), `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

## Icons (optional polish)

Add `public/icon.ico` (Windows) and `public/icon.icns` (Mac) and reference them in
`package.json > build` to replace the default Electron icon.
