# PDF Translator API

Fastify-based API that splits large PDFs into chunks under 10MB and translates them using Google Translate's document translation feature via Playwright automation.

## Features

- **PDF Splitting**: Automatically splits PDFs into chunks smaller than 10MB
- **Google Translate Integration**: Uses Playwright to automate document translation
- **Batch Processing**: Handles multiple chunks and merges them back together
- **Language Support**: Configurable source and target languages

## Installation

```bash
npm install
```

## Install Playwright Browsers

```bash
npx playwright install chromium
```

## Usage

### Start the server

```bash
npm run dev   # Development with auto-reload
npm start     # Production
```

The API will start on `http://localhost:3001`

## Debugging & Dev Mode

### Enable Dev Mode

Dev mode opens the browser visibly and saves debug screenshots during translation.

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and set:
```bash
DEV_MODE=true
```

3. Restart the server:
```bash
npm run dev
```

### What Dev Mode Does

When `DEV_MODE=true`:
- ✅ Browser opens **visibly** so you can see what's happening
- ✅ **Slower execution** (500ms delay between actions for visibility)
- ✅ **Debug screenshots** saved automatically to `debug-screenshots/`:
  - `01-initial-load.png` - Google Translate page loaded
  - `02-file-uploaded.png` - After file upload
  - `03-before-translate-click.png` - Before clicking translate
  - `04-after-translate-click.png` - After clicking translate
  - `05-before-download.png` - Before downloading
  - `99-error.png` - If an error occurs
- ✅ **Detailed logging** of every step in the console

### Debugging Tips

1. **Check the logs** - Every action is logged with detailed information
2. **Look at screenshots** - The `debug-screenshots/` folder shows exactly what the browser sees
3. **Watch the browser** - With DEV_MODE enabled, you can see the automation in real-time
4. **Check failed translations** - Error details are logged for each failed chunk

## API Endpoints

### POST /api/translate

Translates a PDF document.

**Headers:**
- `source-lang` (optional): Source language code (default: 'en')
- `target-lang` (optional): Target language code (default: 'es')

**Body:**
- Form-data with file field containing the PDF

**Response:**
- Returns the translated PDF file

**Example with curl:**

```bash
curl -X POST http://localhost:3001/api/translate \
  -H "source-lang: en" \
  -H "target-lang: es" \
  -F "file=@document.pdf" \
  --output translated_document.pdf
```

### POST /api/analyze

Analyzes a PDF and shows how it would be split into chunks.

**Body:**
- Form-data with file field containing the PDF

**Response:**
```json
{
  "filename": "document.pdf",
  "totalSize": 15728640,
  "chunks": [
    {
      "index": 1,
      "startPage": 1,
      "endPage": 25,
      "size": 9437184,
      "sizeReadable": "9.00 MB"
    },
    {
      "index": 2,
      "startPage": 26,
      "endPage": 50,
      "size": 6291456,
      "sizeReadable": "6.00 MB"
    }
  ],
  "totalChunks": 2
}
```

### GET /health

Health check endpoint.

## How It Works

1. **Upload**: User uploads a PDF file
2. **Analysis**: API checks if the PDF exceeds 10MB
3. **Splitting**: If needed, PDF is split into smaller chunks
4. **Translation**: Each chunk is uploaded to Google Translate via Playwright automation
5. **Download**: Translated chunks are downloaded
6. **Merging**: All translated chunks are merged into a single PDF
7. **Return**: Merged translated PDF is sent back to the user
8. **Cleanup**: Temporary files are deleted

## Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Set to 'true' to open browser visibly and enable debug screenshots
DEV_MODE=false

# Server configuration
PORT=3001
HOST=0.0.0.0
```

### Defaults

- Port: 3001
- Max file size: 100MB
- Chunk size: 9MB (to stay under 10MB limit)
- Default source language: English (en)
- Default target language: Spanish (es)

## Notes

- Google Translate's document translation has daily limits for free usage
- Translation time depends on document size and Google's processing speed
- The API uses headless Chromium browser for automation
- Temporary files are stored in the `temp/` directory and cleaned up after processing
