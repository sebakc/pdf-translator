import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

const DEV_MODE = process.env.DEV_MODE === 'true';
const SCREENSHOT_DIR = path.join(process.cwd(), 'debug-screenshots');

export class GoogleTranslator {
  constructor(logger = console) {
    this.browser = null;
    this.logger = logger;
  }

  async init() {
    if (!this.browser) {
      this.logger.info(`Launching browser in ${DEV_MODE ? 'VISIBLE' : 'headless'} mode`);

      const launchOptions = {
        headless: !DEV_MODE,
        slowMo: DEV_MODE ? 500 : 0,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--hide-scrollbars',
          '--mute-audio',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ]
      };

      this.browser = await chromium.launch(launchOptions);
      this.logger.info('Browser launched successfully');
    }
  }

  async takeScreenshot(page, name) {
    if (DEV_MODE) {
      try {
        await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
        const screenshotPath = path.join(SCREENSHOT_DIR, `${name}-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        this.logger.info(`Screenshot saved: ${screenshotPath}`);
      } catch (err) {
        this.logger.error(`Failed to save screenshot: ${err.message}`);
      }
    }
  }

  async translateDocument(filePath, sourceLang = 'en', targetLang = 'es') {
    await this.init();

    const downloadPath = path.dirname(filePath);

    // Create a persistent context to avoid incognito mode
    const context = await this.browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'es-ES',
      timezoneId: 'America/Mexico_City',
      colorScheme: 'light',
      extraHTTPHeaders: {
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      }
    });

    const page = await context.newPage();

    // Add stealth scripts to evade bot detection
    await page.addInitScript(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override the navigator.plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
          ];
        },
      });

      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['es-ES', 'es', 'en-US', 'en'],
      });

      // Mock chrome property properly
      if (!window.chrome) {
        window.chrome = {};
      }
      window.chrome.runtime = {
        connect: () => {},
        sendMessage: () => {},
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Add additional browser properties
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });

      // Override automation-related properties
      delete navigator.__proto__.webdriver;
    });

    // Enable download events logging
    page.on('download', async download => {
      this.logger.info(`Download event triggered: ${download.suggestedFilename()}`);
    });

    try {
      this.logger.info(`Starting translation: ${path.basename(filePath)} (${sourceLang} -> ${targetLang})`);

      // Navigate to Google Translate document upload page
      const url = `https://translate.google.com/?hl=${targetLang}&sl=${sourceLang}&tl=${targetLang}&op=docs`;
      this.logger.info(`Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle' });
      await this.takeScreenshot(page, '01-initial-load');

      // Find and upload file using the hidden file input
      this.logger.info('Looking for file input...');
      const fileInput = await page.locator('input[type="file"][name="file"]').first();
      this.logger.info('File input found');

      this.logger.info(`Uploading file: ${filePath}`);
      await fileInput.setInputFiles(filePath);
      await page.waitForTimeout(3000); // Give more time for file to upload
      await this.takeScreenshot(page, '02-file-uploaded');

      // Wait for and click the translate button
      // The button text depends on the interface language (hl parameter)
      this.logger.info('Waiting for translate button...');

      const translateButtonTexts = ['Traducir', 'Translate', 'Traduire', 'Übersetzen'];
      let translateButton = null;

      for (const buttonText of translateButtonTexts) {
        try {
          this.logger.info(`Looking for translate button with text: "${buttonText}"`);
          translateButton = page.getByRole('button', { name: buttonText, exact: true });
          await translateButton.waitFor({ state: 'visible', timeout: 3000 });
          this.logger.info(`Found translate button: "${buttonText}"`);
          break;
        } catch (err) {
          this.logger.warn(`Button "${buttonText}" not found`);
        }
      }

      if (!translateButton) {
        await this.takeScreenshot(page, '03-translate-button-not-found');
        throw new Error('Could not find translate button');
      }

      await this.takeScreenshot(page, '03-before-translate-click');
      this.logger.info('Clicking translate button...');
      await translateButton.click();

      // Wait a bit for the translation to start
      await page.waitForTimeout(2000);
      await this.takeScreenshot(page, '04-after-translate-click');

      // Check if page/context is still open
      if (page.isClosed()) {
        this.logger.error('Page was closed after clicking translate button!');
        throw new Error('Google Translate closed the page - possible bot detection');
      }

      // Wait for translation to complete by looking for the download button
      this.logger.info('Waiting for translation to complete...');

      const downloadButtonTexts = [
        'Descargar traducción',
        'Download translation',
        'Télécharger la traduction',
        'Übersetzung herunterladen'
      ];

      let downloadButton = null;
      let downloadButtonFound = false;

      // Try to find download button with longer timeout
      for (const buttonText of downloadButtonTexts) {
        if (downloadButtonFound) break;

        try {
          // Check if page is still open before waiting
          if (page.isClosed()) {
            this.logger.error('Page closed while waiting for download button');
            throw new Error('Google Translate closed the page - possible bot detection or translation failed');
          }

          this.logger.info(`Looking for download button with text: "${buttonText}"`);
          downloadButton = page.getByRole('button', { name: buttonText });
          await downloadButton.waitFor({ state: 'visible', timeout: 180000 }); // 3 minutes
          this.logger.info(`Found download button: "${buttonText}"`);
          downloadButtonFound = true;
          break;
        } catch (err) {
          // Check if error is due to page/context being closed
          if (err.message && err.message.includes('Target page, context or browser has been closed')) {
            this.logger.error('Page/context/browser was closed while waiting for download button');
            throw new Error('Google Translate closed the page - likely bot detection. Try enabling DEV_MODE=true to debug.');
          }
          this.logger.warn(`Download button "${buttonText}" not found: ${err.message}`);
        }
      }

      if (!downloadButtonFound) {
        await this.takeScreenshot(page, '05-download-button-not-found');
        throw new Error('Could not find download button - translation may have failed or timed out');
      }

      await this.takeScreenshot(page, '05-before-download');

      // Set up download handling
      const downloadPath = path.dirname(filePath);
      this.logger.info(`Setting up download to: ${downloadPath}`);

      this.logger.info('Setting up download listener...');
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

      this.logger.info('Clicking download button...');
      await downloadButton.click();

      this.logger.info('Waiting for download to start...');
      const download = await downloadPromise;

      // Log download details
      const suggestedFilename = download.suggestedFilename();
      this.logger.info(`Download started! Suggested filename: ${suggestedFilename}`);

      const filename = `translated_${path.basename(filePath)}`;
      const savePath = path.join(downloadPath, filename);

      this.logger.info(`Attempting to save to: ${savePath}`);

      try {
        await download.saveAs(savePath);
        this.logger.info(`File saved successfully to: ${savePath}`);

        // Verify the file exists
        const stats = await fs.stat(savePath);
        this.logger.info(`File size: ${stats.size} bytes`);
      } catch (saveError) {
        this.logger.error(`Failed to save download: ${saveError.message}`);
        throw saveError;
      }

      this.logger.info(`Translation completed successfully: ${savePath}`);

      await context.close();

      return {
        success: true,
        translatedPath: savePath,
        originalPath: filePath
      };

    } catch (error) {
      this.logger.error(`Translation error: ${error.message}`);

      try {
        if (!page.isClosed()) {
          await this.takeScreenshot(page, '99-error');
        }
      } catch (screenshotErr) {
        this.logger.warn(`Could not take error screenshot: ${screenshotErr.message}`);
      }

      try {
        await context.close();
      } catch (closeErr) {
        this.logger.warn(`Could not close context: ${closeErr.message}`);
      }

      // If browser is in a bad state, close it so next attempt recreates it
      if (error.message && error.message.includes('Target page, context or browser has been closed')) {
        this.logger.warn('Browser appears to be in bad state, closing it for next attempt');
        try {
          await this.close();
        } catch (browserCloseErr) {
          this.logger.warn(`Could not close browser: ${browserCloseErr.message}`);
        }
      }

      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  async translateMultipleDocuments(filePaths, sourceLang = 'en', targetLang = 'es') {
    const results = [];

    this.logger.info(`Starting batch translation of ${filePaths.length} files`);

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      this.logger.info(`[${i + 1}/${filePaths.length}] Processing: ${path.basename(filePath)}`);

      try {
        const result = await this.translateDocument(filePath, sourceLang, targetLang);
        results.push(result);
        this.logger.info(`[${i + 1}/${filePaths.length}] Success: ${path.basename(filePath)}`);
      } catch (error) {
        this.logger.error(`[${i + 1}/${filePaths.length}] Failed: ${path.basename(filePath)} - ${error.message}`);
        results.push({
          success: false,
          originalPath: filePath,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Batch translation complete: ${successCount}/${filePaths.length} successful`);

    return results;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
