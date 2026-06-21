/**
 * Telegram bridge — B.5 channel integration.
 * Polls Telegram API and forwards messages to chat use-cases.
 */

import { randomBytes } from 'crypto';
import TelegramBot from 'node-telegram-bot-api';

import { createLogger } from '../logger';

const logger = createLogger('telegram-bridge');

interface PairingEntry {
  code: string;
  telegramId?: string;
  wolfkrowUserId: string;
  expiresAt: Date;
}

export class TelegramBridge {
  private bot: TelegramBot | undefined;
  private pairings = new Map<string, PairingEntry>(); // keyed by code
  private userMap = new Map<string, string>(); // telegramId → wolfkrowUserId

  async start(token: string): Promise<void> {
    if (this.bot) return;

    this.bot = new TelegramBot(token, { polling: true });
    logger.info('Telegram bridge started');

    this.bot.on('polling_error', (err) => {
      logger.error({ err }, 'Telegram polling error');
    });

    this.bot.onText(/\/start/, (msg) => {
      void this.bot?.sendMessage(
        msg.chat.id,
        'Welcome to Wolfkrow! Use /pair <code> to connect your account.',
      );
    });

    this.bot.onText(/\/pair (.+)/, async (msg, match) => {
      const code = match?.[1]?.trim().toUpperCase() ?? '';
      const telegramId = String(msg.from?.id ?? '');

      const entry = this.findByCode(code);
      if (!entry || entry.expiresAt < new Date()) {
        await this.bot?.sendMessage(msg.chat.id, 'Invalid or expired pairing code.');
        return;
      }

      entry.telegramId = telegramId;
      this.userMap.set(telegramId, entry.wolfkrowUserId);
      logger.info({ telegramId, wolfkrowUserId: entry.wolfkrowUserId }, 'Telegram user paired');
      await this.bot?.sendMessage(msg.chat.id, 'Paired successfully! You can now chat with Wolfkrow.');
    });

    this.bot.on('message', async (msg) => {
      const telegramId = String(msg.from?.id ?? '');
      if (!this.userMap.has(telegramId)) return;
      if (msg.text?.startsWith('/')) return; // handled by command listeners

      const text = msg.text ?? '';
      if (!text) return;

      // Echo back placeholder — real impl routes to chat use-case
      logger.info({ telegramId, text }, 'Telegram message received');
      await this.bot?.sendMessage(msg.chat.id, `Wolfkrow received: "${text}" (chat routing coming soon)`);
    });
  }

  stop(): void {
    if (!this.bot) return;
    void this.bot.stopPolling();
    this.bot = undefined;
    logger.info('Telegram bridge stopped');
  }

  generatePairingCode(wolfkrowUserId: string): string {
    const code = randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    this.pairings.set(code, { code, wolfkrowUserId, expiresAt });
    return code;
  }

  private findByCode(code: string): PairingEntry | undefined {
    return this.pairings.get(code);
  }

  isStarted(): boolean {
    return !!this.bot;
  }
}

export const telegramBridge = new TelegramBridge();
