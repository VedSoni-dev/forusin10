# Releasing & auto-update

The app updates itself from **GitHub Releases** using `electron-updater`.
When an update is published, installed apps show an **update button** in the title
bar — it downloads in the background, then "Restart to update" installs it.

## Cutting a release

1. Bump the version and create a tag:
   ```bash
   npm version patch      # 0.1.0 -> 0.1.1  (use minor/major as needed)
   git push --follow-tags
   ```
2. Pushing the `v*` tag triggers `.github/workflows/release.yml`, which:
   - builds on **Windows** and **macOS** runners (you can't build a Mac app on Windows),
   - publishes installers + the `latest.yml` / `latest-mac.yml` update manifests
     to a GitHub Release.
3. Existing users get the update automatically within ~6 hours, or on next launch.

That's it — unlimited free builds via GitHub Actions on a public repo.

## Platform notes

- **Windows** — auto-update works out of the box. The unsigned installer shows a
  SmartScreen warning ("More info → Run anyway") until you buy a code-signing cert.
- **macOS** — the build (DMG/zip) works, but **auto-update only works if the app is
  signed + notarized** with an Apple Developer account ($99/yr). Without it, Mac
  users download new versions manually. Add these GitHub secrets later to enable it:
  `CSC_LINK` (base64 .p12), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

## Icons (optional polish)

Add `public/icon.ico` (Windows) and `public/icon.icns` (Mac) and reference them in
`package.json > build` to replace the default Electron icon.
