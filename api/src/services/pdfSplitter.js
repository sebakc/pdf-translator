import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

const MAX_SIZE_BYTES = 9 * 1024 * 1024; // 9MB

export class PDFSplitter {
  async splitPDF(inputBuffer) {
    const chunks = [];
    const pdfDoc = await PDFDocument.load(inputBuffer);
    const totalPages = pdfDoc.getPageCount();

    let currentChunk = await PDFDocument.create();
    let currentPages = [];
    let startPage = 0;

    for (let i = 0; i < totalPages; i++) {
      const testDoc = await PDFDocument.create();

      // Copy all pages we want to include in this chunk
      for (let j = startPage; j <= i; j++) {
        const [copiedPage] = await testDoc.copyPages(pdfDoc, [j]);
        testDoc.addPage(copiedPage);
      }

      const testBytes = await testDoc.save();

      // If adding this page would exceed size limit, save current chunk and start new one
      if (testBytes.length > MAX_SIZE_BYTES && i > startPage) {
        // Save current chunk (without the page that made it too large)
        const chunkDoc = await PDFDocument.create();
        for (let j = startPage; j < i; j++) {
          const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [j]);
          chunkDoc.addPage(copiedPage);
        }

        const chunkBytes = await chunkDoc.save();
        chunks.push({
          buffer: Buffer.from(chunkBytes),
          startPage: startPage + 1,
          endPage: i,
          size: chunkBytes.length
        });

        // Start new chunk from current page
        startPage = i;
      }
    }

    // Save final chunk
    if (startPage < totalPages) {
      const chunkDoc = await PDFDocument.create();
      for (let j = startPage; j < totalPages; j++) {
        const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [j]);
        chunkDoc.addPage(copiedPage);
      }

      const chunkBytes = await chunkDoc.save();
      chunks.push({
        buffer: Buffer.from(chunkBytes),
        startPage: startPage + 1,
        endPage: totalPages,
        size: chunkBytes.length
      });
    }

    return chunks;
  }

  async saveTempChunks(chunks, baseFilename) {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const chunkPaths = [];

    for (let i = 0; i < chunks.length; i++) {
      const filename = `${baseFilename}_chunk_${i + 1}.pdf`;
      const filepath = path.join(tempDir, filename);
      await fs.writeFile(filepath, chunks[i].buffer);
      chunkPaths.push({
        path: filepath,
        filename,
        ...chunks[i]
      });
    }

    return chunkPaths;
  }

  async cleanup(filepaths) {
    for (const filepath of filepaths) {
      try {
        await fs.unlink(filepath);
      } catch (err) {
        console.error(`Failed to delete ${filepath}:`, err);
      }
    }
  }
}
