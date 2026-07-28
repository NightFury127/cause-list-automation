import dotenv from 'dotenv';
import path from 'node:path';
import process from 'node:process';

dotenv.config();

const TIME_ZONE = 'Asia/Kolkata';

function required(name, fallback) {
  const value = process.env[name] || fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalized(name, fallback, { stripWhitespace = false } = {}) {
  const value = required(name, fallback).trim();

  if (stripWhitespace) {
    return value.replace(/\s+/g, '');
  }

  return value;
}

export const config = Object.freeze({
  timeZone: TIME_ZONE,
  advocate: normalized('ADVOCATE', 'Suyog'),
  bench: normalized('BENCH', 'B'),
  email: normalized('EMAIL', 'rakshithmukund02@gmail.com'),
  gmailUser: normalized('GMAIL_USER'),
  gmailAppPassword: normalized('GMAIL_APP_PASSWORD', undefined, { stripWhitespace: true }),
  outputDir: path.resolve(process.cwd(), 'output'),
  baseUrl: 'https://judiciary.karnataka.gov.in',
  encryptionEndpoint: 'https://judiciary.karnataka.gov.in/encrypt.php',
  causeListEndpoint: 'https://judiciary.karnataka.gov.in/causeListSearchResp.php',
  courtName: 'Karnataka High Court Bengaluru Bench'
});

export default config;