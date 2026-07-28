import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import config from './config.js';
import logger from './logger.js';
import { fetchCauseListHtml } from './court.js';
import { generateDocxFromData } from './docx.js';
import { buildOutputPaths, buildCauseListDateRange, ensureDirectory, extractCauseListData, getNextWorkingDay } from './utils.js';
import { sendMail } from './mail.js';

function buildEmailSubject(advocate) {
  return `High Court of Karnataka Cause List - ${advocate}`;
}

function buildEmailBody() {
  return "Attached is today's Karnataka High Court cause list.";
}

async function saveTextFile(filePath, content) {
  await fs.writeFile(filePath, content, 'utf8');
}

async function saveJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function runDailyCauseListJob() {
  await ensureDirectory(config.outputDir);

  const scheduledFor = getNextWorkingDay();
  const { fromDate, toDate } = buildCauseListDateRange(scheduledFor, 6);
  const outputPaths = buildOutputPaths(config.outputDir, scheduledFor);

  logger.info('Start', {
    advocate: config.advocate,
    bench: config.bench,
    scheduledFor,
    fromDate,
    toDate
  });

  const { html } = await fetchCauseListHtml({
    encryptionEndpoint: config.encryptionEndpoint,
    causeListEndpoint: config.causeListEndpoint,
    bench: config.bench,
    advocate: config.advocate,
    fromDate,
    toDate,
    logger
  });

  await saveTextFile(outputPaths.htmlPath, html);

  const structuredData = extractCauseListData(html, {
    courtName: config.courtName,
    advocate: config.advocate,
    bench: config.bench,
    scheduledFor
  });

  await saveJsonFile(outputPaths.jsonPath, structuredData);

  const generatedDocxPath = await generateDocxFromData({
    data: structuredData,
    outputPath: outputPaths.docxPath,
    logger
  });

  try {
    await sendMail({
      gmailUser: config.gmailUser,
      gmailAppPassword: config.gmailAppPassword,
      to: config.email,
      subject: buildEmailSubject(config.advocate),
      text: buildEmailBody(),
      attachmentPath: generatedDocxPath,
      logger
    });
  } catch (error) {
    logger.warn('Email delivery failed; keeping the generated files', error);
  }

  logger.info('Workflow completed', {
    outputDir: path.relative(process.cwd(), config.outputDir) || config.outputDir
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDailyCauseListJob().catch((error) => {
    logger.error('Workflow failed', error);
    process.exitCode = 1;
  });
}