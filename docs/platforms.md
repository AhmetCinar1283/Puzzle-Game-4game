# Platforms

## Web (Cloudflare Pages)

- `npm run build` → `next build` → static export to `out/`
- `next.config.ts`: `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`
- Deployed automatically; no Node.js server needed

## Android (Capacitor)

- `capacitor.config.ts`: `appId: 'com.syncron.app'`, `webDir: 'out'`, `androidScheme: 'https'`
- `trailingSlash: true` in next.config.ts — required for Capacitor WebView routing
- `android/` directory committed to git; build artifacts gitignored

### Build Workflow

1. `npm run build:mobile` → `next build && cap sync`
2. `npm run cap:open` → opens Android Studio
3. In Android Studio: Build → Generate Signed APK / Bundle

### Notes

- For Firebase `linkWithPopup` → use `linkWithRedirect` + `getRedirectResult` on Android/Capacitor
- Cloudflare Pages deployment is unaffected: runs `npm run build` only

## Electron (Desktop — Windows/Mac/Linux)

- `electron/main.js` — main process: creates fullscreen BrowserWindow, disables native context menu, disables DevTools in prod, F11 toggles fullscreen, ESC exits fullscreen
- `electron/preload.js` — exposes `window.electron.isElectron = true` for environment detection
- `electron-builder.yml`: `asar: false` (required for Next.js static files via `file://`), outputs to `dist-electron/`
- `"main": "electron/main.js"` in package.json

### Game Feel Features

- Starts fullscreen (`fullscreen: true`)
- No menu bar (`Menu.setApplicationMenu(null)`)
- Native context menu disabled
- DevTools shortcuts blocked in production (F12, Ctrl+Shift+I, Ctrl+U)
- F11 / ESC to toggle fullscreen

### Build Workflows

```bash
npm run electron:dist:win   # → dist-electron/ NSIS installer (.exe)
npm run electron:dist:mac   # → .dmg
npm run electron:dist:linux # → .AppImage
```

**Dev:** `npm run dev` in one terminal, `npm run electron:dev` in another.
