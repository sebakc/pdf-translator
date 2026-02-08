# PDF Translator

A full-stack application for translating PDF documents using Google Translate. Large PDFs are automatically split into chunks under 10MB for processing.

## Project Structure

```
pdf-translator/
├── api/                    # Fastify backend API
│   ├── src/
│   │   ├── index.js       # Main server file
│   │   ├── routes/        # API routes
│   │   └── services/      # Business logic
│   ├── package.json
│   └── README.md
└── app/                    # Next.js frontend
    ├── src/
    ├── package.json
    └── README.md
```

## Quick Start

### Using Makefile (Recommended)

```bash
# Install all dependencies
make install

# Start both API and App
make all
```

That's it! The API runs on `http://localhost:3001` and the frontend on `http://localhost:3000`

### Available Make Commands

```bash
make help              # Show all available commands
make install           # Install all dependencies (API + App + Playwright)
make install-api       # Install API dependencies only
make install-app       # Install App dependencies only
make start-api         # Start API server only (port 3001)
make start-app         # Start Next.js app only (port 3000)
make all               # Start both API and App concurrently
make dev               # Alias for 'make all'
make clean             # Remove node_modules and temp files
```

### Manual Installation (Alternative)

<details>
<summary>Click to expand manual installation steps</summary>

#### 1. Install API Dependencies

```bash
cd api
npm install
npx playwright install chromium
```

#### 2. Install Frontend Dependencies

```bash
cd app
npm install
```

#### 3. Start the API Server

```bash
cd api
npm run dev
```

The API will run on `http://localhost:3001`

#### 4. Start the Frontend

```bash
cd app
npm run dev
```

The frontend will run on `http://localhost:3000`

</details>

## Features

- **Automatic PDF Splitting**: PDFs larger than 10MB are automatically split into smaller chunks
- **Google Translate Integration**: Uses Google Translate's document translation feature
- **Multiple Language Support**: Translate between any languages supported by Google Translate
- **Automated Processing**: Playwright automation handles the entire translation workflow
- **PDF Merging**: Translated chunks are automatically merged back into a single document

## API Usage

See the [API README](./api/README.md) for detailed API documentation.

### Example: Translate a PDF

```bash
curl -X POST http://localhost:3001/api/translate \
  -H "source-lang: en" \
  -H "target-lang: es" \
  -F "file=@document.pdf" \
  --output translated_document.pdf
```

### Example: Analyze a PDF

```bash
curl -X POST http://localhost:3001/api/analyze \
  -F "file=@document.pdf"
```

## How It Works

1. User uploads a PDF through the frontend or API
2. Backend analyzes the PDF size
3. If > 10MB, the PDF is split into smaller chunks
4. Each chunk is uploaded to Google Translate via Playwright automation
5. Translated chunks are downloaded
6. All chunks are merged into a single translated PDF
7. The result is sent back to the user

## Technology Stack

- **Backend**: Fastify, Playwright, pdf-lib
- **Frontend**: Next.js, React, TailwindCSS
- **Automation**: Playwright (Chromium)

## Notes

- Google Translate has usage limits for document translation
- Translation time varies based on document size
- Temporary files are automatically cleaned up after processing
- The API supports files up to 100MB total size

## License

ISC
