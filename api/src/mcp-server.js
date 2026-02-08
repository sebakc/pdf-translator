#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PDFSplitter } from './services/pdfSplitter.js';
import { GoogleTranslator } from './services/translator.js';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

const DEV_MODE = process.env.DEV_MODE === 'true';

// IMPORTANT: Use console.error for logging in STDIO servers (writes to stderr)
// Never use console.log as it writes to stdout and corrupts JSON-RPC messages
const logger = {
  info: (msg) => console.error(`[INFO] ${msg}`),
  warn: (msg) => console.error(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
};

// Initialize services
const pdfSplitter = new PDFSplitter();
const translator = new GoogleTranslator(logger);

// Create MCP server
const server = new Server(
  {
    name: 'pdf-translator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'translate_pdf',
        description: 'Translate a PDF document from one language to another. Automatically splits large PDFs into chunks under 10MB, translates each chunk using Google Translate, and merges them back into a single PDF.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Absolute path to the PDF file to translate',
            },
            sourceLang: {
              type: 'string',
              description: 'Source language code (e.g., "en" for English)',
              default: 'en',
            },
            targetLang: {
              type: 'string',
              description: 'Target language code (e.g., "es" for Spanish)',
              default: 'es',
            },
            outputPath: {
              type: 'string',
              description: 'Optional absolute path where to save the translated PDF. If not provided, saves as "translated_<original_name>.pdf" in the same directory.',
            },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'analyze_pdf',
        description: 'Analyze a PDF file to see how it would be split into chunks for translation. Shows the number of chunks, page ranges, and sizes without performing translation.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Absolute path to the PDF file to analyze',
            },
          },
          required: ['filePath'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logger.info(`Received tool call: ${name}`);

  try {
    if (name === 'analyze_pdf') {
      const { filePath } = args;

      logger.info(`Analyzing PDF: ${filePath}`);

      // Read the PDF file
      const buffer = await fs.readFile(filePath);
      const chunks = await pdfSplitter.splitPDF(buffer);

      const analysis = {
        filename: path.basename(filePath),
        totalSize: buffer.length,
        totalSizeReadable: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
        chunks: chunks.map((chunk, index) => ({
          index: index + 1,
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          pages: chunk.endPage - chunk.startPage + 1,
          size: chunk.size,
          sizeReadable: `${(chunk.size / 1024 / 1024).toFixed(2)} MB`,
        })),
        totalChunks: chunks.length,
        willBeSplit: chunks.length > 1,
      };

      logger.info(`Analysis complete: ${chunks.length} chunks`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    }

    if (name === 'translate_pdf') {
      const { filePath, sourceLang = 'en', targetLang = 'es', outputPath } = args;

      logger.info(`Starting translation: ${filePath} (${sourceLang} -> ${targetLang})`);

      // Read the PDF file
      const buffer = await fs.readFile(filePath);
      const originalFilename = path.basename(filePath, '.pdf');
      const originalDir = path.dirname(filePath);

      // Split PDF into chunks
      logger.info('Splitting PDF into chunks...');
      const chunks = await pdfSplitter.splitPDF(buffer);
      logger.info(`Split into ${chunks.length} chunks`);

      // Save chunks to temporary files
      const chunkPaths = await pdfSplitter.saveTempChunks(chunks, originalFilename);
      logger.info(`Saved ${chunkPaths.length} temporary chunk files`);

      let translatedPaths = [];

      try {
        // Translate each chunk
        logger.info('Starting translation...');
        const translationResults = await translator.translateMultipleDocuments(
          chunkPaths.map(c => c.path),
          sourceLang,
          targetLang
        );

        // Check for translation errors
        const failedTranslations = translationResults.filter(r => !r.success);
        if (failedTranslations.length > 0) {
          logger.error(`Failed translations: ${JSON.stringify(failedTranslations)}`);
          throw new Error(`${failedTranslations.length} translations failed. Check logs for details.`);
        }

        translatedPaths = translationResults.map(r => r.translatedPath);
        logger.info(`Successfully translated ${translatedPaths.length} chunks`);

        // Log translated paths
        logger.info('Translated file paths:');
        translatedPaths.forEach((p, i) => {
          logger.info(`  [${i + 1}] ${p}`);
        });

        // Merge translated PDFs
        logger.info('Merging translated PDFs...');
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < translatedPaths.length; i++) {
          const translatedPath = translatedPaths[i];
          logger.info(`Merging file ${i + 1}/${translatedPaths.length}: ${path.basename(translatedPath)}`);

          const pdfBytes = await fs.readFile(translatedPath);
          const pdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        logger.info('PDF merge complete');

        // Determine output path
        const finalOutputPath = outputPath || path.join(originalDir, `translated_${originalFilename}.pdf`);

        // Save the merged PDF
        await fs.writeFile(finalOutputPath, mergedPdfBytes);
        logger.info(`Translated PDF saved to: ${finalOutputPath}`);

        // Cleanup temporary files
        await pdfSplitter.cleanup(chunkPaths.map(c => c.path));
        await pdfSplitter.cleanup(translatedPaths);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'PDF translated successfully',
                originalFile: filePath,
                translatedFile: finalOutputPath,
                chunks: chunks.length,
                sourceLang,
                targetLang,
                fileSize: mergedPdfBytes.length,
                fileSizeReadable: `${(mergedPdfBytes.length / 1024 / 1024).toFixed(2)} MB`,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        // Cleanup on error
        if (chunkPaths.length > 0) {
          await pdfSplitter.cleanup(chunkPaths.map(c => c.path));
        }
        if (translatedPaths.length > 0) {
          await pdfSplitter.cleanup(translatedPaths);
        }
        throw error;
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    logger.error(`Tool execution error: ${error.message}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            stack: DEV_MODE ? error.stack : undefined,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('PDF Translator MCP Server started');
  if (DEV_MODE) {
    logger.warn('⚠️  DEV_MODE is ENABLED - Browser will be visible and screenshots will be saved');
  }
}

main().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
