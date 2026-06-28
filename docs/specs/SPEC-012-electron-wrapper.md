# SPEC-012: Electron Wrapper

**Status**: 📝 Draft
**Camada**: Wrapper (Electron)
**Prioridade**: P1 (importante)

---

## 1. Visão Geral

Wrapper Electron mínimo (~300 linhas) que gerencia systray + hotkey global + auto-launch. Spawna Next.js + Worker como child processes e abre BrowserWindow.

---

## 2. Componentes

### 2.1 Main Process

```typescript
// apps/wrapper/src/main.ts (~300 linhas)
import { app, BrowserWindow, Tray, Menu, globalShortcut, shell, dialog } from 'electron';
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

  // ... implementação completa
}

const wrapper = new WolfkrowWrapper();
app.whenReady().then(() => wrapper.start());
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => wrapper.quit());
```

---

## 3. Lifecycle

### 3.1 Boot Sequence

```
1. Electron app starts
2. Spawn Next.js process (production: bundled server.js)
3. Spawn Worker process (production: bundled index.js)
4. Wait for Next.js health check (max 30s)
5. Create BrowserWindow → load http://localhost:3000
6. Create Tray icon
7. Register global shortcut
8. Setup auto-launch (if enabled)
9. Show window
```

### 3.2 Shutdown Sequence

```
1. SIGTERM/quit triggered
2. Hide window
3. Kill Next.js process (SIGTERM, then SIGKILL after 5s)
4. Kill Worker process (graceful: SIGTERM, await cleanup)
5. App quit
```

---

## 4. Features

### 4.1 Systray

Menu items:

- **Abrir Wolfkrow** → show window
- **Chat Rápido** → show + navigate /chat
- **Bloquear** → send lock event to renderer
- **Abrir no Browser** → shell.openExternal
- **Sair** → quit

Click on tray icon: toggle window visibility.

### 4.2 Global Hotkey

`CommandOrControl+Shift+Space` (configurable in v1.1):

- Toggle window visibility
- If shown + focused: hide
- If hidden or not focused: show + focus + send "focus-chat-input" IPC

### 4.3 Auto-Launch

```typescript
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true, // Start in tray
});
```

Configurable in Settings (default: enabled).

### 4.4 Native Dialogs

```typescript
// File picker for upload
const result = await dialog.showOpenDialog({
  properties: ['openFile', 'multiSelections'],
  filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'csv', 'xlsx', 'md'] }],
});
```

### 4.5 Native Notifications

```typescript
new Notification({
  title: 'Wolfkrow Tool',
  body: 'Task "Daily briefing" completed',
  icon: path.join(__dirname, '../resources/icon.png'),
}).show();
```

---

## 5. IPC Bridge (limited)

Wrapper → Renderer:

- `navigate` (string: path)
- `lock-app`
- `focus-chat-input`
- `show-notification` (string: title, string: body)

Renderer → Wrapper:

- `quit`
- `hide`
- `open-external` (string: url)
- `pick-files` → returns string[]

---

## 6. Distribution

### electron-builder.yml

```yaml
appId: ai.wolfkrow.tool
productName: Wolfkrow Tool

mac:
  icon: resources/icon.icns
  target:
    - target: dmg
      arch: [x64, arm64]
  hardenedRuntime: true
  entitlements: resources/entitlements.mac.plist
  gatekeeperAssess: false

win:
  target: [nsis]
  icon: resources/icon.ico

linux:
  target: [AppImage]
  category: Development

files:
  - apps/wrapper/dist/**/*
  - apps/web/.next/**/*
  - apps/worker/dist/**/*
  - packages/infra/dist/**/*
  - node_modules/**/*

extraResources:
  - from: .wolfkrow
    to: .wolfkrow
  - from: resources/whisper.cpp
    to: whisper.cpp
  - from: resources/ffmpeg
    to: ffmpeg
```

### Code Signing

```bash
# macOS
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --options runtime \
  --entitlements resources/entitlements.mac.plist \
  dist/mac/Wolfkrow\ Tool.app

xcrun notarytool submit dist/Wolfkrow-Tool.dmg --wait
xcrun stapler staple dist/Wolfkrow-Tool.dmg

# Windows
CSC_LINK=cert.p12 CSC_KEY_PASSWORD=password electron-builder --win
```

---

## 7. Auto-Update

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Update available',
      message: `Version ${info.version} is available.`,
      buttons: ['Download', 'Later'],
    })
    .then((result) => {
      if (result.response === 0) autoUpdater.downloadUpdate();
    });
});

autoUpdater.on('update-downloaded', () => {
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'Restart to apply update.',
      buttons: ['Restart', 'Later'],
    })
    .then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
});

setInterval(() => autoUpdater.checkForUpdates(), 60 * 60 * 1000); // hourly
```

---

## 8. Build Commands

```bash
pnpm wrapper:build    # Compile wrapper TS
pnpm web:build        # Next.js build
pnpm worker:build     # Worker build
pnpm dist:mac         # DMG
pnpm dist:win         # NSIS
pnpm dist:linux       # AppImage
```

---

## 9. Testes

### Unit

- Spawn services
- Health check wait
- Window lifecycle
- Hotkey registration

### Integration

- Full boot sequence
- Graceful shutdown
- Auto-update flow

### E2E (Playwright + Electron)

- Click tray → window opens
- Press hotkey → window toggles
- Quit → processes killed cleanly
