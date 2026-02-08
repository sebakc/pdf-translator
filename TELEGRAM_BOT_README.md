# Telegram Bot with Local API Support

This Telegram bot supports both the public Telegram Bot API and the local Telegram Bot API server for handling large files.

## Key Features

- **Dual API Mode Support**: Works with both public and local Telegram Bot API
- **Large File Support**: When using local API mode, supports files up to 2000 MB
- **Automatic File Handling**: Automatically detects API mode and uses appropriate file retrieval method

## File Handling

### Public API Mode
- Files are downloaded via HTTP from `https://api.telegram.org`
- File size limit: 20 MB
- `file.file_path` returns a relative path like `documents/file_123.pdf`

### Local API Mode (with `--local` flag)
- Files are copied directly from the filesystem
- File size limit: 2000 MB
- `file.file_path` returns an absolute filesystem path like `/var/lib/telegram-bot-api/<token>/documents/file.pdf`

## Configuration

Set the following environment variables:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Optional - for local API mode
USE_LOCAL_API=true
TELEGRAM_API_URL=http://localhost:8081
```

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Run

```bash
# Public API mode
TELEGRAM_BOT_TOKEN=your_token npm start

# Local API mode
TELEGRAM_BOT_TOKEN=your_token USE_LOCAL_API=true TELEGRAM_API_URL=http://localhost:8081 npm start
```

## Development

```bash
npm run dev
```

## Implementation Details

The document handler in `src/bot/telegram-bot.ts` (lines 67-88) implements the dual-mode file handling:

1. **Local API Mode**: When `useLocalApi` is enabled, the bot uses `fs.copyFile()` to copy the file from its existing location on disk
2. **Public API Mode**: When using the public API, the bot downloads the file via HTTP using `fetch()`

This allows the bot to handle large files (>20 MB) when running with a local Telegram Bot API server, while maintaining compatibility with the public API for smaller files.
