import { chromium } from 'playwright';

/**
 * Generates a PDF from the provided HTML using Playwright and Chromium.
 *
 * @param {object} options - PDF generation options.
 * @param {string} options.html - HTML content to render.
 * @param {string} options.outputPath - Target PDF file path.
 * @param {object} [options.logger] - Logger instance.
 * @returns {Promise<void>}
 */
export async function generatePdfFromHtml({ html, outputPath, logger }) {
  logger?.info('PDF generation started', { outputPath });

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'screen' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '10mm',
        right: '8mm',
        bottom: '10mm',
        left: '8mm'
      }
    });
  } finally {
    await browser.close();
  }

  logger?.info('PDF generation completed', { outputPath });
}