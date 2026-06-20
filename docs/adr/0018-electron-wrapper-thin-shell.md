# ADR-0018: Electron Wrapper Mínimo (~300 linhas)

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O Wolfkrow Tool como standalone web app funciona perfeitamente no browser. Mas precisamos de conveniência desktop:

1. **Systray icon** (menu: Open, Quick Chat, Lock, Quit)
2. **Global hotkey** (Cmd+Shift+Space para abrir chat de qualquer app)
3. **Auto-launch on login**
4. **Browser app mode** (sem address bar, devtools)
5. **Native dialogs** (file picker para uploads grandes)

Decisão: Electron wrapper mínimo (~300 linhas) ou PWA pura?

## Decisão

**Electron wrapper mínimo** (~300 linhas) que:
- Spawna Next.js + Worker como child processes
- Abre BrowserWindow apontando para `http://localhost:3000`
- Gerencia systray + hotkey + auto-launch

```typescript
// apps/wrapper/src/main.ts (~300 linhas)
import { app, BrowserWindow, Tray, Menu, globalShortcut, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';

class WolfkrowWrapper {
  private nextProcess?: ChildProcess;
  private workerProcess?: ChildProcess;
  private mainWindow?: BrowserWindow;
  private tray?: Tray;
  
  async start() {
    await this.spawnServices();
    await this.waitForServer();
    this.createWindow();
    this.createTray();
    this.registerHotkeys();
    this.setupAutoLaunch();
  }
  
  private async spawnServices() {
    const isDev = !app.isPackaged;
    
    if (isDev) {
      // Dev: assume user ran `pnpm dev` separately
      return;
    }
    
    // Production: spawn bundled Next.js + Worker
    const resourcesPath = process.resourcesPath;
    
    this.nextProcess = spawn(process.execPath, [
      path.join(resourcesPath, 'web/server.js'),
    ], {
      env: { ...process.env, PORT: '3000', NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    this.workerProcess = spawn(process.execPath, [
      path.join(resourcesPath, 'worker/index.js'),
    ], {
      env: { ...process.env, PORT: '4000', NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });
  }
  
  private async waitForServer(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch('http://localhost:3000/api/health');
        if (res.ok) return;
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Next.js failed to start in 30s');
  }
  
  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      title: 'Wolfkrow Tool',
      icon: path.join(__dirname, '../resources/icon.png'),
      autoHideMenuBar: true,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      backgroundColor: '#0a0a0a',
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    
    this.mainWindow.loadURL('http://localhost:3000');
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });
    
    // Hide instead of close (X button)
    this.mainWindow.on('close', (e) => {
      if (!app.isQuitting) {
        e.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }
  
  private createTray() {
    this.tray = new Tray(path.join(__dirname, '../resources/tray-icon.png'));
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Abrir Wolfkrow', click: () => this.showWindow() },
      { label: 'Chat Rápido', click: () => this.quickChat() },
      { type: 'separator' },
      { label: 'Bloquear', click: () => this.lock() },
      { type: 'separator' },
      { label: 'Abrir no Browser', click: () => shell.openExternal('http://localhost:3000') },
      { type: 'separator' },
      { label: 'Sair', click: () => this.quit() },
    ]);
    
    this.tray.setToolTip('Wolfkrow Tool');
    this.tray.setContextMenu(contextMenu);
    
    this.tray.on('click', () => {
      if (this.mainWindow?.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.showWindow();
      }
    });
  }
  
  private registerHotkeys() {
    // Cmd+Shift+Space (mac) / Ctrl+Shift+Space (win/linux)
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (this.mainWindow?.isVisible() && this.mainWindow.isFocused()) {
        this.mainWindow.hide();
      } else {
        this.showWindow();
        this.mainWindow?.webContents.send('focus-chat-input');
      }
    });
  }
  
  private setupAutoLaunch() {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true, // Start minimized to tray
      });
    }
  }
  
  private showWindow() {
    if (!this.mainWindow) return;
    
    if (this.mainWindow.isMinimized()) this.mainWindow.restore();
    this.mainWindow.show();
    this.mainWindow.focus();
  }
  
  private quickChat() {
    this.showWindow();
    this.mainWindow?.webContents.send('navigate', '/chat');
  }
  
  private lock() {
    this.mainWindow?.webContents.send('lock-app');
  }
  
  private async quit() {
    app.isQuitting = true;
    
    // Graceful shutdown
    this.nextProcess?.kill('SIGTERM');
    this.workerProcess?.kill('SIGTERM');
    
    await new Promise(r => setTimeout(r, 2000)); // Wait for cleanup
    
    app.quit();
  }
}

// Entry point
const wrapper = new WolfkrowWrapper();

app.whenReady().then(() => wrapper.start());

app.on('window-all-closed', (e: Event) => {
  // Don't quit when window closed (stay in tray)
  e.preventDefault();
});

app.on('before-quit', async () => {
  await wrapper.quit();
});
```

## Consequências

### Positivas

- **UX desktop nativa**: systray, hotkey, auto-launch
- **Bundle familiar**: usuários Electron sabem o que esperar
- **Cross-platform**: macOS, Windows, Linux
- **Code signing**: distribuição profissional
- **Auto-update**: electron-updater built-in
- **File dialogs nativos**: file picker para uploads
- **Notifications nativas**: OS notifications

### Negativas

- **Bundle size**: ~80MB (Electron + Chromium)
- **Mais um processo**: Next.js + Worker + Electron
- **Code signing caro**: $100/ano (Apple), $200+ (Windows EV)
- **Memory**: ~300-500MB para Electron

### Mitigações

- Distribuição dual: PWA (light) + Electron (full UX)
- Documentar requisitos de sistema
- Auto-update channel via GitHub Releases

## Tamanho do Bundle

| Component | Size |
|---|---|
| Electron runtime | ~70MB |
| Next.js (production) | ~20MB |
| Worker | ~5MB |
| MCPs | ~30MB total |
| Resources (icon, etc) | ~1MB |
| **Total DMG** | **~120-150MB** |

Aceitável para desktop app.

## Alternativas Consideradas

### A. PWA only (no Electron)

**Prós**: Sem overhead, browser-only
**Contras**: Sem systray, sem hotkey global, sem auto-launch
**Decisão**: ✅ Disponível como alternativa (install no Chrome)

### B. Tauri (Rust)

**Prós**: Bundle menor (~10MB), Rust memory safety, melhor performance
**Contras**: Ecossistema menor, learning curve Rust, sem alguns features
**Decisão**: 🤔 Considerado para v2.0

### C. Neutralinojs

**Prós**: Mais leve que Electron
**Contras**: Ecossistema muito pequeno
**Decisão**: ❌ Rejeitado

### D. Wails (Go + WebView)

**Prós**: Bundle pequeno, Go backend
**Contras**: Não é JavaScript nativo
**Decisão**: ❌ Rejeitado

## Code Signing

### macOS

```bash
# Requires Apple Developer account ($99/year)
# Certificate: Developer ID Application
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --options runtime \
  --entitlements resources/entitlements.mac.plist \
  --entitlements-inherited resources/entitlements.mac.plist \
  dist/mac/Wolfkrow\ Tool.app

# Notarize
xcrun notarytool submit dist/Wolfkrow-Tool.dmg \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID" \
  --wait

# Staple
xcrun stapler staple dist/Wolfkrow-Tool.dmg
```

### Windows

```bash
# Requires Windows EV certificate (~$300/year) ou self-signed
# electron-builder handles signing via CSC_LINK env var
CSC_LINK=path/to/cert.p12 CSC_KEY_PASSWORD=password \
  electron-builder --win
```

## Auto-Update

```typescript
// apps/wrapper/src/auto-update.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  // Show notification: "New version available"
  dialog.showMessageBox({
    type: 'info',
    title: 'Update available',
    message: `Version ${info.version} is available. Download now?`,
    buttons: ['Download', 'Later'],
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update ready',
    message: 'Update downloaded. Restart to apply.',
    buttons: ['Restart', 'Later'],
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.checkForUpdates();
```

## Distribuição

### electron-builder.yml

```yaml
appId: ai.wolfkrow.tool
productName: Wolfkrow Tool
copyright: Copyright (c) 2026 Wolfkrow Labs

directories:
  output: release
  buildResources: resources

files:
  - dist/**/*
  - apps/wrapper/dist/**/*
  - apps/web/.next/**/*
  - apps/worker/dist/**/*
  - packages/infra/dist/**/*
  - node_modules/**/*

extraResources:
  - from: .wolfkrow
    to: .wolfkrow
    filter: ['**/*', '!data/**']
  - from: resources/whisper.cpp
    to: whisper.cpp
  - from: resources/ffmpeg
    to: ffmpeg

mac:
  icon: resources/icon.icns
  target:
    - target: dmg
      arch: [x64, arm64]
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: resources/entitlements.mac.plist
  entitlementsInherit: resources/entitlements.mac.plist

win:
  target: [nsis]
  icon: resources/icon.ico

linux:
  target: [AppImage]
  icon: resources/icon.png
  category: Development

asar: true
asarUnpack:
  - "**/*.node"
  - "**/better-sqlite3/**"
  - "**/keytar/**"
  - "**/sqlite-vec/**"
```

## References

- [Electron Docs](https://www.electronjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [electron-updater](https://www.electron.build/auto-update)
- [Tauri](https://tauri.app/)
- [PWA](https://web.dev/progressive-web-apps/)
