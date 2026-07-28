# cause-list-automation

Automates the Karnataka High Court Bengaluru Bench cause list for Advocate Suyog, renders the official HTML into a Word DOCX, extracts structured case data to JSON, and emails the DOCX to the configured recipient every weekday at 8:16 PM IST.

## Installation

1. Install Node.js 24 or newer.
2. Clone the repository and open `cause-list-automation`.
3. Install dependencies with `npm install`.
4. Copy `.env.example` to `.env` and fill in Gmail credentials.

## Environment Variables

The application reads the following variables from `.env` or the GitHub Actions environment:

- `ADVOCATE` - default `Suyog`
- `BENCH` - default `B`
- `EMAIL` - destination email address
- `GMAIL_USER` - Gmail account used to send mail
- `GMAIL_APP_PASSWORD` - Gmail App Password

## Local Execution

Run the full workflow locally with:

```bash
npm start
```

The run will:

1. Calculate the next working day in IST.
2. Request the encrypted dataset from the Karnataka Judiciary site.
3. Fetch the official cause list HTML.
4. Save the HTML, DOCX, and JSON artifacts in `output/`.
5. Email the generated DOCX.

## GitHub Actions Setup

The workflow lives in `.github/workflows/daily.yml` and runs every **weekday** (Monday–Friday) at `20:16` IST (`14:46` UTC). Weekend runs are skipped to preserve free-tier minutes.

### 1. Add repository secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and add each of the following:

| Secret | Description |
|--------|-------------|
| `ADVOCATE` | Advocate name to search (e.g. `Suyog`) |
| `BENCH` | Bench code (e.g. `B`) |
| `EMAIL` | Recipient email address |
| `GMAIL_USER` | Gmail account used to send mail |
| `GMAIL_APP_PASSWORD` | Gmail App Password (see below) |

### 2. Trigger manually (first run)

After adding secrets, go to **Actions → Daily Cause List → Run workflow** to verify the run end-to-end before the scheduled job fires.

### What the workflow does

1. Checks out the repository.
2. Installs Node.js 24.
3. Runs `npm ci` (no Playwright/Chromium needed — not used in the default path).
4. Runs `npm start` with secrets injected as environment variables.
5. Uploads the generated DOCX, JSON, and HTML as a downloadable artifact retained for **7 days**.
6. Writes a markdown job summary visible on the Actions run page.
7. Automatically cancels if the job exceeds **15 minutes** (`timeout-minutes`).

## Gmail App Password Setup

1. Enable 2-Step Verification on the Gmail account used for sending mail.
2. Open Google Account security settings.
3. Create an App Password for Mail.
4. Store the generated password in `GMAIL_APP_PASSWORD`.

## Output

Each run writes files to `output/` using the next working day as the filename stem:

- `YYYY-MM-DD.html`
- `YYYY-MM-DD.docx`
- `YYYY-MM-DD.json`

These are also uploaded as a GitHub Actions artifact named `cause-list-<run-id>` and can be downloaded from the run page for 7 days — useful as a fallback if email delivery fails.

## Troubleshooting

- If the workflow fails to send mail, verify the Gmail App Password and that 2-Step Verification is enabled.
- If the website returns no results, confirm the advocate name and bench code match the court portal.
- If the output is empty, inspect the saved HTML file from the uploaded artifact to see whether the site changed its structure.
- If the job hangs, it will be automatically cancelled after 15 minutes (`timeout-minutes: 15`).