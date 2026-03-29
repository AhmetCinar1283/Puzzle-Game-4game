const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
const path = require('path');

// --dev flag → load from Next.js dev server (localhost:3000)
// no flag   → load from out/ (static export)
const isDev = process.argv.includes('--dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#030712', // match game bg — no white flash on load
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ── Disable native context menu (Inspect Element etc.) ──────────────────
  // React onContextMenu handlers on elements still fire normally.
  win.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // ── Disable DevTools in production ────────────────────────────────────────
  if (!isDev) {
    win.webContents.on('before-input-event', (event, input) => {
      if (
        (input.key === 'F12') ||
        (input.control && input.shift && input.key === 'I') ||
        (input.control && input.shift && input.key === 'J') ||
        (input.control && input.key === 'U')
      ) {
        event.preventDefault();
      }
    });
  }

  // ── F11 toggles fullscreen, Escape exits fullscreen ───────────────────────
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
    if (input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
      event.preventDefault();
    }
  });

  // ── Load the app ──────────────────────────────────────────────────────────
  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // Works both when running `electron .` locally and when packaged
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'out', 'index.html')
      : path.join(__dirname, '..', 'out', 'index.html');
    win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  // Remove the default File/Edit/View/… menu bar
  Menu.setApplicationMenu(null);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
