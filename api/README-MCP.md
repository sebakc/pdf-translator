# PDF Translator MCP Server

Model Context Protocol (MCP) server for translating PDF documents using Google Translate with Playwright automation.

## Features

- **translate_pdf**: Translate PDF documents from one language to another
  - Automatically splits large PDFs into chunks < 10MB
  - Translates each chunk using Google Translate
  - Merges translated chunks back into a single PDF

- **analyze_pdf**: Analyze how a PDF would be split into chunks
  - Shows number of chunks, page ranges, and sizes
  - No translation performed

## Installation

```bash
cd api
npm install
npx playwright install chrome
```

## Running the Server

### Standalone

```bash
npm run dev
```

### With Claude Desktop

Add this to your `claude_desktop_config.json`:

**macOS/Linux:**
```json
{
  "mcpServers": {
    "pdf-translator": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/pdf-translator/api/src/mcp-server.js"
      ],
      "env": {
        "DEV_MODE": "false"
      }
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "pdf-translator": {
      "command": "node",
      "args": [
        "C:\\ABSOLUTE\\PATH\\TO\\pdf-translator\\api\\src\\mcp-server.js"
      ],
      "env": {
        "DEV_MODE": "false"
      }
    }
  }
}
```

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Tools

### translate_pdf

Translate a PDF document.

**Parameters:**
- `filePath` (required): Absolute path to the PDF file
- `sourceLang` (optional): Source language code (default: "en")
- `targetLang` (optional): Target language code (default: "es")
- `outputPath` (optional): Where to save the translated PDF

**Example usage in Claude:**
```
Translate /Users/me/document.pdf from English to Spanish
```

**Response:**
```json
{
  "success": true,
  "message": "PDF translated successfully",
  "originalFile": "/Users/me/document.pdf",
  "translatedFile": "/Users/me/translated_document.pdf",
  "chunks": 3,
  "sourceLang": "en",
  "targetLang": "es",
  "fileSize": 15728640,
  "fileSizeReadable": "15.00 MB"
}
```

### analyze_pdf

Analyze a PDF file to see how it would be split.

**Parameters:**
- `filePath` (required): Absolute path to the PDF file

**Example usage in Claude:**
```
Analyze /Users/me/large-document.pdf
```

**Response:**
```json
{
  "filename": "large-document.pdf",
  "totalSize": 25887325,
  "totalSizeReadable": "24.69 MB",
  "chunks": [
    {
      "index": 1,
      "startPage": 1,
      "endPage": 25,
      "pages": 25,
      "size": 9437184,
      "sizeReadable": "9.00 MB"
    },
    {
      "index": 2,
      "startPage": 26,
      "endPage": 50,
      "pages": 25,
      "size": 8000000,
      "sizeReadable": "7.63 MB"
    }
  ],
  "totalChunks": 2,
  "willBeSplit": true
}
```

## Environment Variables

- `DEV_MODE`: Set to "true" to open browser visibly and save debug screenshots
  - Default: "false"
  - Useful for debugging translation issues

## How It Works

1. **Upload**: PDF file is read from the specified path
2. **Analysis**: System checks if PDF exceeds 9MB
3. **Splitting**: If needed, PDF is split into smaller chunks
4. **Translation**: Each chunk is translated via Google Translate using Playwright
5. **Download**: Translated chunks are downloaded
6. **Merging**: All translated chunks are merged into a single PDF
7. **Save**: Final translated PDF is saved to the specified output path
8. **Cleanup**: Temporary files are automatically deleted

## Supported Languages

Any language pair supported by Google Translate. Common codes:
- `en`: English
- `es`: Spanish
- `fr`: French
- `de`: German
- `it`: Italian
- `pt`: Portuguese
- `ja`: Japanese
- `zh`: Chinese
- `ar`: Arabic
- `ru`: Russian

## Troubleshooting

### Server not showing up in Claude Desktop

1. Check the config file path is correct
2. Ensure you're using absolute paths (not relative)
3. Restart Claude Desktop completely (Cmd+Q on Mac, not just close window)
4. Check logs: `tail -f ~/Library/Logs/Claude/mcp*.log`

### Translation fails

1. Enable DEV_MODE to see the browser
2. Check `api/debug-screenshots/` for screenshots
3. Verify Chrome is installed for Playwright
4. Check the logs for detailed error messages

### Downloads blocked

Make sure Playwright's Chrome browser is installed:
```bash
npx playwright install chrome
```

## Notes

- Google Translate has usage limits
- Translation time varies with document size
- Temporary files are stored in `api/temp/`
- Debug screenshots saved in `api/debug-screenshots/` when DEV_MODE is enabled
- Maximum file size: 100MB

## License

ISC
