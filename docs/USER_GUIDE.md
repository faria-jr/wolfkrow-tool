# Wolfkrow User Guide

## Overview

Wolfkrow is a local-first AI assistant platform that runs entirely on your machine. All conversations, documents, and configurations stay on your device — nothing is sent to external servers except the AI model API calls you configure.

## Quick start

### Installation

**macOS**: Download `Wolfkrow-<version>.dmg`, open it, and drag Wolfkrow to Applications.

**Windows**: Run `Wolfkrow-Setup-<version>.exe` and follow the installer.

**Linux**: Download `Wolfkrow-<version>.AppImage`, make it executable (`chmod +x`), and run it.

### First launch

1. Wolfkrow starts and opens the web UI at `http://localhost:3000`
2. Enter your Anthropic API key in **Settings → Vault → ANTHROPIC_API_KEY**
3. Start chatting

### System tray

After launch, Wolfkrow lives in your system tray. Click the icon to:

- **Open** — bring the window to front
- **Quick Chat** — open a floating chat window
- **Lock** — lock the session
- **Open in Browser** — open in your default browser
- **Quit** — stop all Wolfkrow processes

### Global hotkey

Press `Cmd+Shift+Space` (macOS) or `Ctrl+Shift+Space` (Windows/Linux) to show or hide the main window from anywhere.

### Auto-launch

Wolfkrow can start automatically when you log in. Toggle this in **Settings → General → Start at login**.

---

## Chat

### Starting a conversation

Click **New Chat** in the sidebar or press `Cmd+N`. Type your message and press Enter.

### Using agents

Agents are AI personas with specific system prompts, tool access, and model settings. Select an agent from the dropdown above the chat input. Create and manage agents in **Settings → Agents**.

### Attaching files

Drag a file onto the chat input or click the attachment icon. Supported types: PDF, DOCX, TXT, Markdown, images, code files.

### Voice input

Click the microphone icon (or press `Cmd+Shift+V`) to dictate your message. Voice transcription runs locally.

---

## Knowledge base

### Uploading documents

Go to **Knowledge → Documents** and click **Upload**. Wolfkrow parses the file, splits it into chunks, embeds each chunk, and stores it for semantic search.

Supported formats: PDF, DOCX, TXT, MD, HTML, CSV, and most plain-text source code files.

### Searching knowledge

From **Knowledge → Search**, type a natural-language query. Results are ranked by semantic similarity. You can filter by document.

### Using knowledge in chat

When an agent has **Knowledge: Enabled** in its settings, relevant chunks are automatically included in each chat turn. You can also pin specific documents to a conversation.

---

## Vault (secrets management)

The Vault stores API keys and credentials securely using your operating system's keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service).

### Adding a secret

Go to **Settings → Vault → Add secret**. Required fields:

- **Key**: identifier used in code/agents (e.g., `OPENAI_API_KEY`)
- **Display name**: human-readable label
- **Category**: `ai`, `integration`, `oauth`, or `other`
- **Value**: the actual secret (stored in keychain, never logged)

### Using secrets in agents

Reference a vault secret in an agent's environment by key: `${OPENAI_API_KEY}`. Wolfkrow resolves the value at runtime without exposing it in logs or the UI.

---

## Tasks

Go to **Tasks** to create and manage structured tasks separate from chat conversations.

### Creating a task

Click **New Task** and fill in:

- **Title** (required)
- **Description** (optional)
- **Status**: `todo`, `in_progress`, `blocked`, `done`, `cancelled`
- **Priority**: `low`, `medium`, `high`, `urgent`
- **Category**: `work`, `personal`, `learning`, `health`, `finance`, `other`
- **Due date** (optional)
- **Tags** (optional)

### Filtering tasks

Use the filter bar at the top of the Tasks page to filter by status or category.

---

## Automation (scheduled tasks)

Create cron-based tasks that run AI agents on a schedule.

### Creating a scheduled task

Go to **Settings → Automation → New scheduled task**:

- **Name**: descriptive label
- **Cron expression**: standard cron syntax (e.g., `0 9 * * 1-5` = weekdays at 9am)
- **Timezone**: defaults to your local timezone
- **Prompt**: the message sent to the agent
- **Agent**: which agent runs the task
- **Tags**: for organization

### Pausing and resuming

Toggle the **Enabled** switch on any task to pause/resume it without deleting it.

---

## Global rules

Rules shape how agents behave. Go to **Settings → Rules** to manage them.

### Rule kinds

| Kind       | Purpose                                          |
| ---------- | ------------------------------------------------ |
| `behavior` | How agents should respond (tone, format, length) |
| `soul`     | Fundamental values and ethical principles        |
| `user`     | Facts about you (name, role, preferences)        |
| `custom`   | Project-specific or context-specific rules       |

### Rule priority

Rules are applied in sort-order (lower number = higher priority). Drag rules to reorder.

---

## Knowledge graph

The **Graph** page shows entities and relationships extracted from your conversations and documents. Nodes represent people, concepts, and topics. Edges represent relationships.

Click any node to see its connections and filter the graph. Use the search bar to find specific nodes.

---

## Terminal (PTY)

The **Terminal** page embeds a full terminal session running inside Wolfkrow. Click **New Session** to start a shell. The terminal session persists as long as the worker process runs.

---

## Design Studio (Sidecar)

The **Design** page embeds a design tool in an iframe. Click **Start Studio** to launch it. The studio authenticates automatically using your Wolfkrow session.

---

## Settings

### API keys

- **Settings → Vault**: manage all secrets
- Required for AI features: `ANTHROPIC_API_KEY`
- Optional: `VOYAGE_API_KEY` (for improved semantic search), `TELEGRAM_BOT_TOKEN`

### Appearance

- **Settings → Appearance**: toggle light/dark mode, set font size

### Data & Privacy

- **Settings → Data**: view data directory path, export data, clear chat history
- All data is stored locally at `~/.wolfkrow/` (macOS/Linux) or `%APPDATA%\Wolfkrow` (Windows)

### Updates

Wolfkrow checks for updates automatically. When an update is available, a notification appears in the tray menu. Click **Update** to download and install.

---

## Keyboard shortcuts

| Action          | macOS             | Windows/Linux      |
| --------------- | ----------------- | ------------------ |
| Toggle window   | `Cmd+Shift+Space` | `Ctrl+Shift+Space` |
| New chat        | `Cmd+N`           | `Ctrl+N`           |
| Voice input     | `Cmd+Shift+V`     | `Ctrl+Shift+V`     |
| Command palette | `Cmd+K`           | `Ctrl+K`           |
| Settings        | `Cmd+,`           | `Ctrl+,`           |

---

## Deferred features (planned for v1.1)

The following are intentionally out of scope for the current release and are **not yet available**:

| Feature                                             | Status      | Notes                                                                                                                                                                                                  |
| --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Interactive clarification (ask-the-user dialog)** | Not in v1.0 | The worker does not emit a clarification-question event in v1.0, so the UI was removed to avoid dead code. Planned for v1.1 with a real worker emitter + round-trip answer channel.                    |
| **Excalidraw inline embed in chat**                 | Not in v1.0 | Excalidraw diagrams render as an **external link** (`https://excalidraw.com/#json=…`, opens in a new tab) rather than inline. The Excalidraw MCP is available; only the inline chat embed is deferred. |
| **Structured mgraph vault (ROAM-like)**             | Not in v1.0 | Relation visualization is covered by the **Graph** page + Graph MCP search. The structured node types (entities/meetings/decisions/…) from LionClaw were not ported. Decision recorded in ADR-0033.    |
| **Harness automatic AI execution**                  | Not in v1.0 | The build harness foundation (planner→coder→evaluator, sprints/rounds, DiffViewer) is present, but end-to-end automated AI execution is deferred.                                                      |
| **STT provider switching UI**                       | Not in v1.0 | Speech-to-text uses local Whisper (preferred) with OpenAI API fallback (see `WHISPER_BIN_PATH`). There is no in-app UI to switch the STT provider.                                                     |
| **Knowledge retrieval benchmark**                   | Removed     | Intentionally removed (ADR-0032).                                                                                                                                                                      |

See [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) for the full feature/deferred tracking.

---

## FAQ

**Q: Is my data sent to Anthropic?**
Only your chat messages are sent to the Anthropic API to generate responses. No file contents, vault secrets, or metadata are sent. See [SECURITY.md](../SECURITY.md) for details.

**Q: Can I use a different AI model?**
Yes. In **Settings → Agents**, you can set any Claude model per agent. Supported models: claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001.

**Q: How do I back up my data?**
Copy the directory `~/.wolfkrow/data/` (macOS/Linux) or `%APPDATA%\Wolfkrow\data\` (Windows). The single file `wolfkrow.db` contains all your data.

**Q: How do I migrate from LionClaw?**
See [MIGRATION_FROM_LIONCLAW.md](./MIGRATION_FROM_LIONCLAW.md).

**Q: Why is the Knowledge search slow?**
Semantic search requires embedding each query. First-time searches on a large knowledge base may take a few seconds. Subsequent searches are faster (results are cached).

**Q: Can Wolfkrow run headless (no Electron)?**
Yes. Start the worker and web app directly:

```bash
pnpm dev
```

Then open `http://localhost:3000` in any browser.
