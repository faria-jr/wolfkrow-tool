# SPEC-010: Telegram Bridge

**Status**: 📝 Draft
**Camada**: Worker
**Prioridade**: P2 (nice-to-have)

---

## 1. Visão Geral

Bot Telegram que permite conversar com Wolfkrow via Telegram. Mensagens roteadas para chat principal.

---

## 2. Setup

1. User cria bot via BotFather
2. User salva token em Wolfkrow Vault
3. Wolfkrow inicia polling
4. User envia `/pair <code>` para conectar

---

## 3. Implementation

```typescript
// apps/worker/src/telegram/bridge.ts
import TelegramBot from 'node-telegram-bot-api';

export class TelegramBridge {
  private bot?: TelegramBot;
  
  async start(): Promise<void> {
    const token = await this.secrets.get('telegram-bot-token');
    if (!token) return;
    
    this.bot = new TelegramBot(token, { polling: true });
    
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      
      // Check if user is paired
      const pairing = await this.pairingRepo.findByTelegramId(userId);
      if (!pairing) {
        await this.bot.sendMessage(chatId, 'Please pair first: /pair <code>');
        return;
      }
      
      // Forward to Wolfkrow chat
      await this.forwardToWolfkrow(pairing.wolfkrowUserId, msg);
    });
    
    this.bot.onText(/\/pair (.+)/, async (msg, match) => {
      const code = match![1];
      const telegramId = String(msg.from!.id);
      
      const pairing = await this.pairingRepo.findByCode(code);
      if (pairing) {
        await this.pairingRepo.update(pairing.id, { telegramId });
        await this.bot.sendMessage(msg.chat.id, 'Paired successfully!');
      } else {
        await this.bot.sendMessage(msg.chat.id, 'Invalid code.');
      }
    });
  }
  
  private async forwardToWolfkrow(wolfkrowUserId: string, msg: TelegramMessage): Promise<void> {
    const useCase = container.get(SendMessage);
    
    let content = msg.text ?? '';
    
    // Handle attachments
    if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1];
      const fileLink = await this.bot.getFileLink(photo.file_id);
      const buffer = await fetch(fileLink).then((r) => r.buffer());
      const attachment = await this.saveAttachment(wolfkrowUserId, buffer, 'photo.jpg');
      content += `\n[attachment: ${attachment.id}]`;
    }
    
    // Send as user message
    const session = await this.getOrCreateTelegramSession(wolfkrowUserId, msg.chat.id);
    
    const chunks: StreamChunk[] = [];
    for await (const chunk of useCase.execute({
      sessionId: session.id,
      agentId: session.agentId,
      content,
      attachments: [],
    })) {
      chunks.push(chunk);
    }
    
    // Reply to user
    const replyText = this.compileText(chunks);
    await this.bot.sendMessage(msg.chat.id, replyText, { parse_mode: 'Markdown' });
  }
}
```

---

## 4. Pairing Flow

```typescript
// User clicks "Connect Telegram" in Wolfkrow UI
export async function generatePairingCode(): Promise<string> {
  const code = randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  
  await this.pairingRepo.create({
    code,
    expiresAt,
    status: 'pending',
  });
  
  return code;
}

// User sends `/pair ABC123` to bot
// Bridge matches code → telegram_id
```

---

## 5. Commands

```
/start - Welcome message
/pair <code> - Pair with Wolfkrow
/new - Start new session
/sessions - List sessions
/switch <id> - Switch to session
/memory <query> - Search memory
/schedule - Show scheduled tasks
```

---

## 6. Testes

- Bot start/stop
- Message routing
- Attachment handling
- Pairing flow
- Multi-user isolation
