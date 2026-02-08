import { TelegramBot } from './bot/telegram-bot';

// Load configuration from environment variables
const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    useLocalApi: process.env.USE_LOCAL_API === 'true',
    apiUrl: process.env.TELEGRAM_API_URL,
  },
};

// Validate configuration
if (!config.telegram.botToken) {
  console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required');
  process.exit(1);
}

if (config.telegram.useLocalApi && !config.telegram.apiUrl) {
  console.error('Error: TELEGRAM_API_URL is required when USE_LOCAL_API=true');
  process.exit(1);
}

// Create and launch bot
const bot = new TelegramBot(config);

bot.launch().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
