import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import fs from 'node:fs/promises';

function cell(text, options = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' }
    },
    children: [
      new Paragraph({
        alignment: options.alignment || AlignmentType.LEFT,
        spacing: { after: 0, before: 0 },
        children: [
          new TextRun({
            text: String(text || ''),
            bold: Boolean(options.bold),
            size: options.size || 18,
            font: 'Bookman Old Style'
          })
        ]
      })
    ]
  });
}

function sectionParagraph(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.LEFT,
    spacing: { before: options.before ?? 120, after: options.after ?? 120 },
    children: [
      new TextRun({
        text: String(text || ''),
        bold: Boolean(options.bold),
        size: options.size || 20,
        font: 'Bookman Old Style'
      })
    ]
  });
}

function multilineParagraphs(text, options = {}) {
  return String(text || '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index, lines) => sectionParagraph(line, {
      alignment: options.alignment || AlignmentType.CENTER,
      bold: options.bold ?? true,
      size: index === 0 ? (options.firstSize || options.size || 18) : (options.size || 14),
      before: index === 0 ? (options.before ?? 0) : 0,
      after: index === lines.length - 1 ? (options.after ?? 0) : 0
    }));
}

function buildCasesTable(cases) {
  const headerRow = new TableRow({
    children: [
      cell('Sl.No.', { bold: true, alignment: AlignmentType.CENTER }),
      cell('Case No.', { bold: true, alignment: AlignmentType.CENTER }),
      cell('Classification', { bold: true, alignment: AlignmentType.CENTER }),
      cell('Pet./Appl./Comp. & Adv.', { bold: true, alignment: AlignmentType.CENTER }),
      cell('Resp. & Adv.', { bold: true, alignment: AlignmentType.CENTER })
    ]
  });

  const dataRows = cases.map((caseRecord) => new TableRow({
    children: [
      cell(caseRecord.slNo || '', { alignment: AlignmentType.CENTER, width: 1100 }),
      cell(caseRecord.caseNumber || '', { alignment: AlignmentType.CENTER, width: 2100 }),
      cell(caseRecord.classification || '', { alignment: AlignmentType.CENTER, width: 1500 }),
      cell(caseRecord.petitioner || '', { width: 4200 }),
      cell(caseRecord.respondent || '', { width: 4200 })
    ]
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows]
  });
}

function buildFooterParagraph(section) {
  const parts = [];

  if (section.website) {
    parts.push(`Website: ${section.website}`);
  }

  if (section.publishedOn) {
    parts.push(`Published on : ${section.publishedOn}`);
  }

  if (section.printedOn) {
    parts.push(`Printed on : ${section.printedOn}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return sectionParagraph(parts.join('   '), {
    alignment: AlignmentType.CENTER,
    size: 14,
    after: 60
  });
}

function buildSectionBlock(section) {
  const paragraphs = [];

  if (section.title) {
    paragraphs.push(...multilineParagraphs(section.title, {
      alignment: AlignmentType.CENTER,
      bold: true,
      firstSize: 18,
      size: 14,
      after: 40
    }));
  }

  if (section.judge) {
    paragraphs.push(...multilineParagraphs(section.judge, {
      alignment: AlignmentType.CENTER,
      bold: true,
      firstSize: 16,
      size: 14,
      after: 20
    }));
  }

  const metadataPieces = [];

  if (section.courtHall) {
    metadataPieces.push(`COURT HALL NO : ${section.courtHall}`);
  }

  if (section.causeListNo) {
    metadataPieces.push(`Cause List No. ${section.causeListNo}`);
  }

  if (metadataPieces.length > 0) {
    paragraphs.push(
      sectionParagraph(metadataPieces.join('   '), {
        alignment: AlignmentType.CENTER,
        size: 14,
        after: 20
      })
    );
  }

  if (section.hearingTime) {
    paragraphs.push(
      sectionParagraph(`at ${section.hearingTime}`, {
        alignment: AlignmentType.CENTER,
        size: 14,
        after: 30
      })
    );
  }

  if (Array.isArray(section.cases) && section.cases.length > 0) {
    paragraphs.push(buildCasesTable(section.cases));
  }

  const footer = buildFooterParagraph(section);
  if (footer) {
    paragraphs.push(footer);
  }

  return paragraphs;
}

function buildCaseSummaryParagraph(caseRecord, index) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({ text: `${index + 1}. `, bold: true }),
      new TextRun({ text: `Sl.No: ${caseRecord.slNo || 'N/A'} | ` }),
      new TextRun({ text: `Case: ${caseRecord.caseNumber || 'N/A'} | ` }),
      new TextRun({ text: `Classification: ${caseRecord.classification || 'N/A'} | ` }),
      new TextRun({ text: `Petitioner: ${caseRecord.petitioner || 'N/A'} | ` }),
      new TextRun({ text: `Respondent: ${caseRecord.respondent || 'N/A'} | ` }),
      new TextRun({ text: `Court Hall: ${caseRecord.courtHall || 'N/A'} | ` }),
      new TextRun({ text: `Judge: ${caseRecord.judge || 'N/A'} | ` }),
      new TextRun({ text: `Stage: ${caseRecord.stage || 'N/A'} | ` }),
      new TextRun({ text: `Remarks: ${caseRecord.remarks || 'N/A'}` })
    ]
  });
}

/**
 * Generates a production DOCX from the extracted cause list data.
 *
 * @param {object} options - DOCX generation options.
 * @param {object} options.data - Structured cause list data.
 * @param {string} options.outputPath - Target `.docx` path.
 * @param {object} [options.logger] - Logger instance.
 * @returns {Promise<void>}
 */
export async function generateDocxFromData({ data, outputPath, logger }) {
  logger?.info('DOCX generation started', { outputPath });

  const children = [];

  const sections = Array.isArray(data.sections) && data.sections.length > 0
    ? data.sections
    : [{ title: '', judge: '', courtHall: '', causeListNo: '', hearingTime: '', website: '', publishedOn: '', printedOn: '', cases: Array.isArray(data.cases) ? data.cases : [] }];

  if (sections.length > 0) {
    sections.forEach((section, index) => {
      if (index > 0) {
        children.push(sectionParagraph('', { after: 120 }));
      }

      buildSectionBlock(section).forEach((paragraph) => children.push(paragraph));
    });
  } else if (data.rawText) {
    children.push(sectionParagraph('Extracted Text', { bold: true, size: 22, after: 60 }));
    data.rawText
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 40)
      .forEach((line) => {
        children.push(sectionParagraph(line, { size: 18, after: 20 }));
      });
  }

  const document = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Bookman Old Style',
            size: 18
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720
            }
          }
        },
        children
      }
    ]
  });

  const buffer = await Packer.toBuffer(document);
  let resolvedOutputPath = outputPath;

  try {
    await fs.writeFile(outputPath, buffer);
  } catch (error) {
    if (error && (error.code === 'EBUSY' || error.code === 'EPERM')) {
      resolvedOutputPath = outputPath.replace(/\.docx$/i, `.generated-${Date.now()}.docx`);
      await fs.writeFile(resolvedOutputPath, buffer);
      logger?.warn('DOCX output path was locked; wrote fallback file instead', {
        outputPath,
        fallbackPath: resolvedOutputPath
      });
    } else {
      throw error;
    }
  }

  logger?.info('DOCX generation completed', { outputPath: resolvedOutputPath });

  return resolvedOutputPath;
}