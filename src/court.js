import { chromium } from 'playwright';
import { createCauseListPayload, normalizeText } from './utils.js';

/**
 * Requests the encrypted dataset and fetches the final cause list HTML.
 *
 * Strategy:
 *  1. Navigate to the court homepage to establish a session (sets cookies,
 *     passes bot-detection challenges).
 *  2. POST to encrypt.php via Playwright's APIRequestContext, which shares the
 *     session cookies from step 1 and uses a Chrome-like TLS fingerprint.
 *  3. Navigate to causeListSearchResp.php in the same browser page to get HTML.
 *
 * @param {object} options - Fetch parameters.
 * @param {string} options.encryptionEndpoint - Encryption endpoint URL.
 * @param {string} options.causeListEndpoint - Cause list endpoint URL.
 * @param {string} options.bench - Bench code.
 * @param {string} options.advocate - Advocate name.
 * @param {string} options.fromDate - From date in `YYYY-MM-DD`.
 * @param {string} options.toDate - To date in `YYYY-MM-DD`.
 * @param {object} [options.logger] - Logger instance.
 * @returns {Promise<{ dataset: string, html: string, causeListUrl: string }>} Cause list payload.
 */
export async function fetchCauseListHtml({
  encryptionEndpoint,
  causeListEndpoint,
  bench,
  advocate,
  fromDate,
  toDate,
  logger
}) {
  const payload = createCauseListPayload({ bench, advocate, fromDate, toDate });
  const baseUrl = new URL(encryptionEndpoint).origin;

  logger?.info('Launching browser for court portal', {
    advocate,
    bench,
    fromDate,
    toDate
  });

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata'
    });

    const page = await context.newPage();

    // ── Step 1: Visit the homepage to establish a session ──────────────────
    // This sets session cookies and passes any bot-detection challenges.
    // context.request below will automatically include these cookies.
    logger?.info('Visiting court homepage to establish session', { baseUrl });

    await page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // ── Step 2: POST to the encryption endpoint ────────────────────────────
    // context.request shares cookies with the browser page, bypasses CORS,
    // and presents a Chrome-like TLS fingerprint to the server.
    logger?.info('Encryption request started', { endpoint: encryptionEndpoint });

    const encryptionResponse = await context.request.post(encryptionEndpoint, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${baseUrl}/`,
        Origin: baseUrl
      },
      data: payload,
      timeout: 60000
    });

    if (!encryptionResponse.ok()) {
      throw new Error(
        `Encryption endpoint responded with HTTP ${encryptionResponse.status()}`
      );
    }

    const encryptionText = await encryptionResponse.text();
    const dataset = extractDataset(encryptionText);

    if (!dataset) {
      throw new Error('Unable to extract encrypted dataset from the encryption response.');
    }

    // ── Step 3: Navigate to the cause list result page ─────────────────────
    const causeListUrl = `${causeListEndpoint}?dataset=${encodeURIComponent(dataset)}`;

    logger?.info('Cause list request started', {
      endpoint: causeListEndpoint,
      datasetLength: dataset.length
    });

    const navResponse = await page.goto(causeListUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    if (!navResponse || !navResponse.ok()) {
      throw new Error(
        `Cause list endpoint responded with HTTP ${navResponse?.status()}`
      );
    }

    const html = await page.content();

    if (!normalizeText(html)) {
      throw new Error('The cause list endpoint returned empty HTML.');
    }

    return { dataset, html, causeListUrl };
  } finally {
    await browser.close();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractDataset(responseData) {
  const text = normalizeText(responseData);

  if (!text) {
    throw new Error('The encryption endpoint returned an empty dataset.');
  }

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'string') {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      return parsed.dataset || parsed.data || parsed.result || text;
    }
  } catch {
    // The endpoint often returns a plain encrypted string.
  }

  const datasetMatch = text.match(/dataset=([^&\s]+)/i);
  if (datasetMatch) {
    return datasetMatch[1];
  }

  return text;
}