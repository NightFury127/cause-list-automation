import axios from 'axios';
import { createCauseListPayload, normalizeText } from './utils.js';

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

/**
 * Requests the encrypted dataset and fetches the final cause list HTML.
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

  logger?.info('Encryption request started', {
    endpoint: encryptionEndpoint,
    advocate,
    bench,
    fromDate,
    toDate
  });

  const encryptionResponse = await axios.post(encryptionEndpoint, payload, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    responseType: 'text',
    timeout: 30000,
    validateStatus: (status) => status >= 200 && status < 300
  });

  const dataset = extractDataset(encryptionResponse.data);

  if (!dataset) {
    throw new Error('Unable to extract encrypted dataset from the encryption response.');
  }

  const causeListUrl = `${causeListEndpoint}?dataset=${encodeURIComponent(dataset)}`;

  logger?.info('Cause list request started', {
    endpoint: causeListEndpoint,
    datasetLength: dataset.length
  });

  const causeListResponse = await axios.get(causeListUrl, {
    responseType: 'text',
    timeout: 30000,
    validateStatus: (status) => status >= 200 && status < 300
  });

  const html = normalizeText(causeListResponse.data) ? causeListResponse.data : '';

  if (!html) {
    throw new Error('The cause list endpoint returned empty HTML.');
  }

  return {
    dataset,
    html,
    causeListUrl
  };
}