import { PDFSplitter } from '../services/pdfSplitter.js';
import { GoogleTranslator } from '../services/translator.js';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

export async function translateRoute(fastify, options) {
  const pdfSplitter = new PDFSplitter();
  const translator = new GoogleTranslator(fastify.log);

  fastify.post('/translate', async (request, reply) => {
    let chunkPaths = [];
    let translatedPaths = [];

    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Get file buffer
      const buffer = await data.toBuffer();
      const originalFilename = data.filename.replace('.pdf', '');

      fastify.log.info(`Received file: ${data.filename}, size: ${buffer.length} bytes`);

      // Split PDF into chunks
      fastify.log.info('Splitting PDF into chunks...');
      const chunks = await pdfSplitter.splitPDF(buffer);
      fastify.log.info(`Split into ${chunks.length} chunks`);

      // Save chunks to temporary files
      chunkPaths = await pdfSplitter.saveTempChunks(chunks, originalFilename);
      fastify.log.info(`Saved ${chunkPaths.length} temporary chunk files`);

      // Get language parameters
      const sourceLang = request.headers['source-lang'] || 'en';
      const targetLang = request.headers['target-lang'] || 'es';

      // Translate each chunk
      fastify.log.info('Starting translation...');
      const translationResults = await translator.translateMultipleDocuments(
        chunkPaths.map(c => c.path),
        sourceLang,
        targetLang
      );

      // Check for translation errors
      const failedTranslations = translationResults.filter(r => !r.success);
      if (failedTranslations.length > 0) {
        fastify.log.error('Failed translations:', failedTranslations);
        throw new Error(`${failedTranslations.length} translations failed. Check logs for details.`);
      }

      translatedPaths = translationResults.map(r => r.translatedPath);
      fastify.log.info(`Successfully translated ${translatedPaths.length} chunks`);

      // Log all translated paths for debugging
      fastify.log.info('Translated file paths:');
      translatedPaths.forEach((path, index) => {
        fastify.log.info(`  [${index + 1}] ${path}`);
      });

      // Merge translated PDFs
      fastify.log.info('Merging translated PDFs...');
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < translatedPaths.length; i++) {
        const translatedPath = translatedPaths[i];
        fastify.log.info(`Merging file ${i + 1}/${translatedPaths.length}: ${translatedPath}`);

        // Check if file exists
        try {
          const stats = await fs.stat(translatedPath);
          fastify.log.info(`  File exists, size: ${stats.size} bytes`);
        } catch (err) {
          fastify.log.error(`  File NOT found: ${translatedPath}`);
          throw new Error(`Translated file not found: ${translatedPath}`);
        }

        const pdfBytes = await fs.readFile(translatedPath);
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      fastify.log.info('PDF merge complete');

      // Cleanup temporary files
      await pdfSplitter.cleanup(chunkPaths.map(c => c.path));
      await pdfSplitter.cleanup(translatedPaths);

      // Send the merged PDF
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="translated_${data.filename}"`)
        .send(Buffer.from(mergedPdfBytes));

    } catch (error) {
      fastify.log.error(error);

      // Cleanup on error
      if (chunkPaths.length > 0) {
        await pdfSplitter.cleanup(chunkPaths.map(c => c.path));
      }
      if (translatedPaths.length > 0) {
        await pdfSplitter.cleanup(translatedPaths);
      }

      reply.code(500).send({
        error: 'Translation failed',
        message: error.message
      });
    }
  });

  // Endpoint to get info about a PDF without translating
  fastify.post('/analyze', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const chunks = await pdfSplitter.splitPDF(buffer);

      return {
        filename: data.filename,
        totalSize: buffer.length,
        chunks: chunks.map((chunk, index) => ({
          index: index + 1,
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          size: chunk.size,
          sizeReadable: `${(chunk.size / 1024 / 1024).toFixed(2)} MB`
        })),
        totalChunks: chunks.length
      };

    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        error: 'Analysis failed',
        message: error.message
      });
    }
  });

  // Cleanup on server shutdown
  fastify.addHook('onClose', async () => {
    await translator.close();
  });
}
