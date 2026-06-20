# Releasing And Auto-Update

The app updates itself from **GitHub Releases** using `electron-updater` and the
GitHub provider configured in `package.json > build > publish`.

Builds run on **Codemagic**. Codemagic builds the installers and publishes them,
plus the `latest.yml` / `latest-mac.yml` update manifests, to a draft GitHub
Release.

## One-Time Setup

In the Codemagic UI, under App settings > Environment variables, add:

- `GH_TOKEN`: a GitHub personal access token with `repo` scope, marked **Secret**.
  electron-builder uses it to upload artifacts to the GitHub Release.

## Cutting A Release

1. Bump the version in `package.json`, for example `npm version patch`, and push.
2. In Codemagic, run the **macOS** and **Windows** workflows. Each workflow:
   - installs dependencies,
   - builds the renderer,
   - downloads the bundled Ollama binary,
   - builds the installer,
   - publishes the installer and update manifest to a draft GitHub Release.
3. On GitHub, publish the draft release.
4. Existing users get the update automatically within about 6 hours, or on next launch.

## Platform Notes

- **Windows**: auto-update works out of the box. The unsigned installer shows a
  SmartScreen warning until a code-signing certificate is added.
- **macOS**: DMG/zip builds work, but auto-update requires the app to be signed
  and notarized with an Apple Developer account. Until then, Mac users download
  new versions manually and open via right-click > Open the first time.

To enable macOS signing later, add these Codemagic environment variables and
remove `CSC_IDENTITY_AUTO_DISCOVERY: "false"` from `codemagic.yaml`:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

## Icons

Add `public/icon.ico` for Windows and `public/icon.icns` for macOS, then reference
them in `package.json > build` to replace the default Electron icon.
