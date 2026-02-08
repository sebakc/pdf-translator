import { Telegraf, Context } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { join } from 'path';

interface TelegramConfig {
  botToken: string;
  useLocalApi?: boolean;
  apiUrl?: string;
}

interface BotConfig {
  telegram: TelegramConfig;
}

// Logger interface
const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
};

export class TelegramBot {
  private bot: Telegraf<Context>;
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
    
    // Initialize Telegraf bot
    const botOptions: any = {
      telegram: {
        apiRoot: config.telegram.useLocalApi && config.telegram.apiUrl 
          ? config.telegram.apiUrl 
          : 'https://api.telegram.org',
      },
    };

    this.bot = new Telegraf(config.telegram.botToken, botOptions);
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Document handler
    this.bot.on('document', async (ctx) => {
      try {
        const document = (ctx.message as Message.DocumentMessage).document;
        const userId = ctx.from?.id;

        if (!document || !userId) {
          logger.warn('Document or user ID missing');
          return;
        }

        logger.info(`Received document: ${document.file_name} (${document.file_size} bytes)`);

        // Get file info
        const file = await this.bot.telegram.getFile(document.file_id);

        const tempDir = join(process.cwd(), 'temp');
        const localFilePath = join(tempDir, `${userId}_${document.file_name}`);
        const fs = await import('fs/promises');

        // Ensure temp directory exists
        await fs.mkdir(tempDir, { recursive: true });

        if (this.config.telegram.useLocalApi && this.config.telegram.apiUrl) {
          // LOCAL API MODE: file.file_path is an absolute path on the filesystem
          // The file already exists on disk (inside the Docker volume mapped directory), just copy it
          logger.info(`Local API mode - file path: ${file.file_path}`);
          await fs.copyFile(file.file_path!, localFilePath);
        } else {
          // PUBLIC API MODE: Download file via HTTP
          const fileUrl = `https://api.telegram.org/file/bot${this.config.telegram.botToken}/${file.file_path}`;
          logger.info(`Downloading from: ${fileUrl}`);
          const response = await fetch(fileUrl);
          const buffer = await response.arrayBuffer();
          await fs.writeFile(localFilePath, Buffer.from(buffer));
        }

        logger.info(`File ready: ${localFilePath}`);
        
        await ctx.reply(`File received: ${document.file_name} (${document.file_size} bytes)`);
        
        // TODO: Process the file here (e.g., translate PDF, etc.)
        
      } catch (error) {
        logger.error(`Error handling document: ${error}`);
        await ctx.reply('Sorry, there was an error processing your file.');
      }
    });

    // Text handler (example)
    this.bot.on('text', async (ctx) => {
      logger.info(`Received text message: ${ctx.message.text}`);
      await ctx.reply('Send me a document to process!');
    });

    // Start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply('Welcome! Send me a document and I will process it.');
    });
  }

  public async launch(): Promise<void> {
    logger.info('Starting Telegram bot...');
    await this.bot.launch();
    logger.info('Bot is running');
  }

  public stop(): void {
    this.bot.stop();
    logger.info('Bot stopped');
  }
}
