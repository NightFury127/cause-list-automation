import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';

const IST_TIME_ZONE = 'Asia/Kolkata';

function formatDateParts(date, timeZone = IST_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function parseIstDate(isoDate) {
  return new Date(`${isoDate}T00:00:00+05:30`);
}

function addDaysToIstDate(isoDate, days) {
  const date = parseIstDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateParts(date);
}

function isWeekend(isoDate) {
  const date = parseIstDate(isoDate);
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function getTodayIstDate(date = new Date()) {
  return formatDateParts(date);
}

/**
 * Returns the next working day in IST, skipping Saturday and Sunday.
 *
 * @param {Date} date - Reference date.
 * @returns {string} ISO date string in `YYYY-MM-DD` format.
 */
export function getNextWorkingDay(date = new Date()) {
  let candidate = addDaysToIstDate(formatDateParts(date), 1);

  while (isWeekend(candidate)) {
    candidate = addDaysToIstDate(candidate, 1);
  }

  return candidate;
}

export function addDays(isoDate, days) {
  return addDaysToIstDate(isoDate, days);
}

export function buildCauseListDateRange(startDate, days = 6) {
  return {
    fromDate: startDate,
    toDate: addDays(startDate, days)
  };
}

/**
 * Formats an ISO date string for the court portal request payload.
 *
 * @param {string} isoDate - Date in `YYYY-MM-DD` format.
 * @returns {string} Date in `DD/MM/YYYY` format.
 */
export function formatCourtDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  return `${day}/${month}/${year}`;
}

export async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

export function buildOutputPaths(outputDir, dateString) {
  return {
    htmlPath: path.join(outputDir, `${dateString}.html`),
    docxPath: path.join(outputDir, `${dateString}.docx`),
    jsonPath: path.join(outputDir, `${dateString}.json`)
  };
}

export function createCauseListPayload({ bench, advocate, fromDate, toDate }) {
  const payload = `flg::2|so::btn|bench::${bench}|SearchType::3|keyWord::${advocate}|fromDt::${formatCourtDate(fromDate)}|toDt::${formatCourtDate(toDate)}|radioc::D`;
  return new URLSearchParams({ url: payload }).toString();
}

export function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseKey(value) {
  return normalizeText(value).toLowerCase();
}

function rowText($, row) {
  return normalizeText($(row).text());
}

function htmlToMultilineText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .join('\n');
}

function cellText($, row, label) {
  const cell = $(row)
    .find(`td[data-label="${label}"]`)
    .first();

  return normalizeText(cell.text());
}

function cellHtmlText($, row, label) {
  const cell = $(row)
    .find(`td[data-label="${label}"]`)
    .first();

  return htmlToMultilineText(cell.html());
}

function rowDataLabels($, row) {
  return $(row)
    .find('td[data-label]')
    .map((_, cell) => normalizeText($(cell).attr('data-label') || ''))
    .get()
    .filter(Boolean);
}

function isCaseRow($, row) {
  const labels = new Set(rowDataLabels($, row));
  return labels.has('Sl.No.') && labels.has('Case No.');
}

function isCaseHeaderRow(text) {
  const compressed = normalizeText(text).replace(/\s+/g, '');
  return compressed === 'Sl.No.CaseNo.Pet./Appl./Comp.&Adv.Resp.&Adv.';
}

function rowHasLabel($, row, label) {
  return $(row).find(`td[data-label="${label}"]`).length > 0;
}

function parseSectionMetadata(text) {
  const metadata = {
    title: '',
    judge: '',
    courtHall: '',
    causeListNo: '',
    hearingTime: '',
    dateLine: '',
    website: '',
    publishedOn: '',
    printedOn: ''
  };

  metadata.title = normalizeText(text);

  const courtHallMatch = text.match(/COURT\s+HALL\s+NO\s*:\s*(.+?)(?=Cause\s+List\s+No\.?|Website:|$)/i);
  if (courtHallMatch) {
    metadata.courtHall = normalizeText(courtHallMatch[1]);
  }

  const causeListNoMatch = text.match(/Cause\s+List\s+No\.?\s*([0-9A-Z/-]+)/i);
  if (causeListNoMatch) {
    metadata.causeListNo = normalizeText(causeListNoMatch[1]);
  }

  const timeMatch = text.match(/at\s+([0-9:]+\s*(?:AM|PM))/i);
  if (timeMatch) {
    metadata.hearingTime = normalizeText(timeMatch[1]);
  }

  const publishedMatch = text.match(/Published\s+on\s*:\s*([0-9-]+\s+[0-9:]+\s+[AP]M)\s+Printed\s+on\s*: ?\s*([0-9-]+\s+[0-9:]+\s+[AP]M)/i);
  if (publishedMatch) {
    metadata.publishedOn = normalizeText(publishedMatch[1]);
    metadata.printedOn = normalizeText(publishedMatch[2]);
  }

  const judgeMatch = text.match(/^(THE\s+HON`?BLE|HON`?BLE|REGISTRAR|COURT\s+HALL|CAUSE\s+LIST)/i);
  if (!judgeMatch) {
    metadata.judge = normalizeText(text);
  }

  return metadata;
}

function parseCaseRow($, row) {
  const caseNoCell = $(row).find('td[data-label="Case No."]').first();
  const caseNumber = normalizeText(caseNoCell.find('a').first().text() || caseNoCell.text().split(/\r?\n/)[0] || '');

  const caseRecord = {
    slNo: cellText($, row, 'Sl.No.') || cellText($, row, 'Sl.No') || '',
    caseNumber,
    classification: cellText($, row, 'Classification') || '',
    petitioner: cellText($, row, 'Pet./Appl./Comp. & Adv.') || '',
    respondent: cellText($, row, 'Resp. & Adv.') || '',
    courtHall: '',
    judge: '',
    stage: '',
    remarks: '',
    extra: {},
    raw: {}
  };

  $(row)
    .find('td')
    .each((_, cell) => {
      const label = normalizeText($(cell).attr('data-label') || '');
      const value = normalizeText($(cell).text());

      if (label) {
        caseRecord.raw[label] = value;
      }
    });

  const combined = normalizeText($(row).text());
  const noteStart = combined.indexOf(caseRecord.respondent);
  if (noteStart >= 0) {
    caseRecord.remarks = normalizeText(combined.slice(noteStart + caseRecord.respondent.length));
  }

  return caseRecord;
}

function setCaseField(caseRecord, label, value) {
  const key = titleCaseKey(label);

  if (/sl\.?\s*no|serial|s\.?\s*no/.test(key)) {
    caseRecord.slNo = value;
    return;
  }

  if (/case\s*no|case\s*number|case\s*details/.test(key)) {
    caseRecord.caseNumber = value;
    return;
  }

  if (/classificat|nature/.test(key)) {
    caseRecord.classification = value;
    return;
  }

  if (/court\s*hall|hall/.test(key)) {
    caseRecord.courtHall = value;
    return;
  }

  if (/judge|justice/.test(key)) {
    caseRecord.judge = value;
    return;
  }

  if (/petitioner|appellant|claimant/.test(key)) {
    caseRecord.petitioner = value;
    return;
  }

  if (/pet\.\/appl\.\/comp\.|petitioner\.?\s*&\s*adv|applicant\.?\s*&\s*adv|comp\.?\s*&\s*adv/.test(key)) {
    caseRecord.petitioner = value;
    return;
  }

  if (/respondent|respondents|defendant/.test(key)) {
    caseRecord.respondent = value;
    return;
  }

  if (/resp\.\s*&\s*adv|respondent\.?\s*&\s*adv/.test(key)) {
    caseRecord.respondent = value;
    return;
  }

  if (/stage|status|hearing/.test(key)) {
    caseRecord.stage = value;
    return;
  }

  if (/remarks?|note|notes/.test(key)) {
    caseRecord.remarks = value;
    return;
  }

  caseRecord.extra[label] = value;
}

/**
 * Extracts structured cause list data from the official HTML.
 *
 * @param {string} html - Cause list HTML.
 * @param {object} [context] - Metadata used to enrich the extracted data.
 * @returns {object} Structured JSON payload.
 */
export function extractCauseListData(html, context = {}) {
  const $ = load(html);
  const title = normalizeText($('title').first().text() || $('h1').first().text());
  const sections = [];
  let currentSection = null;

  const rows = $('table').first().find('tr').toArray();

  for (const row of rows) {
    const rowClass = normalizeText($(row).attr('class') || '');
    const text = rowText($, row);

    if (rowClass.includes('mtable') && text) {
      currentSection = {
        title: htmlToMultilineText($(row).find('td').first().html() || text),
        judge: '',
        courtHall: '',
        causeListNo: '',
        hearingTime: '',
        dateLine: '',
        website: '',
        publishedOn: '',
        printedOn: '',
        cases: []
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      continue;
    }

    if (isCaseHeaderRow(text)) {
      continue;
    }

    if (/^Website:\s*/i.test(text)) {
      const websiteMatch = text.match(/Website:\s*(https?:\/\/\S+)/i);
      const publishedMatch = text.match(/Published on\s*:\s*([0-9-]+\s+[0-9:]+\s+[AP]M)/i);
      const printedMatch = text.match(/Printed on\s*: ?\s*([0-9-]+\s+[0-9:]+\s+[AP]M)/i);

      currentSection.website = normalizeText(websiteMatch?.[1] || '');
      currentSection.publishedOn = normalizeText(publishedMatch?.[1] || '');
      currentSection.printedOn = normalizeText(printedMatch?.[1] || '');

      if (!currentSection.website) {
        currentSection.website = text;
      }

      continue;
    }

    if (/COURT HALL NO/i.test(text)) {
      const metadata = parseSectionMetadata(text);
      currentSection.courtHall = metadata.courtHall || currentSection.courtHall;
      currentSection.causeListNo = metadata.causeListNo || currentSection.causeListNo;
      currentSection.hearingTime = metadata.hearingTime || currentSection.hearingTime;
      continue;
    }

    if (isCaseRow($, row)) {
      currentSection.cases.push(parseCaseRow($, row));
      continue;
    }

    if (!currentSection.judge && text && !/To get Daily Causelist|e-filing|registration of Advocates|Join VC|ORDERS/i.test(text)) {
      currentSection.judge = text;
    }
  }

  const cases = sections.flatMap((section) => section.cases);

  const text = normalizeText($('body').text());

  return {
    court: context.courtName || '',
    advocate: context.advocate || '',
    bench: context.bench || '',
    scheduledFor: context.scheduledFor || '',
    generatedAt: new Date().toISOString(),
    title,
    cases,
    sections,
    rawText: text
  };
}