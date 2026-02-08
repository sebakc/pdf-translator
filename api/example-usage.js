import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Example usage of the PDF Translator API
 *
 * This demonstrates how to:
 * 1. Analyze a PDF to see how it will be split
 * 2. Translate a PDF document
 */

const API_BASE_URL = 'http://localhost:3001/api';

// Example 1: Analyze a PDF
async function analyzePDF(filePath) {
  console.log('Analyzing PDF...');

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  formData.append('file', blob, path.basename(filePath));

  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Analysis result:', JSON.stringify(result, null, 2));
  return result;
}

// Example 2: Translate a PDF
async function translatePDF(filePath, sourceLang = 'en', targetLang = 'es') {
  console.log(`Translating PDF from ${sourceLang} to ${targetLang}...`);

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  formData.append('file', blob, path.basename(filePath));

  const response = await fetch(`${API_BASE_URL}/translate`, {
    method: 'POST',
    headers: {
      'source-lang': sourceLang,
      'target-lang': targetLang,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Translation failed: ${error.message}`);
  }

  // Save the translated PDF
  const arrayBuffer = await response.arrayBuffer();
  const outputPath = path.join(
    path.dirname(filePath),
    `translated_${path.basename(filePath)}`
  );

  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
  console.log(`Translated PDF saved to: ${outputPath}`);
  return outputPath;
}

// Usage example
async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log('Usage: node example-usage.js <path-to-pdf>');
    console.log('Example: node example-usage.js ./my-document.pdf');
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`);
    process.exit(1);
  }

  try {
    // First analyze the PDF
    await analyzePDF(pdfPath);

    // Then translate it
    const translatedPath = await translatePDF(pdfPath, 'en', 'es');
    console.log('Translation complete!');
    console.log('Translated file:', translatedPath);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
