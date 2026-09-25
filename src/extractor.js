const fs = require('fs');
const path = require('path');

async function extractText(filePath, originalName, mimetype) {
  const ext = path.extname(originalName).toLowerCase();

  try {
    if (['.txt', '.text', '.md', '.markdown'].includes(ext)) {
      return fs.readFileSync(filePath, 'utf8');
    }

    if (ext === '.json') {
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return content;
      }
    }

    if (ext === '.pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text || '';
      } catch (pdfErr) {
        console.warn(`PDF extraction warning for ${originalName}:`, pdfErr.message);
        return '';
      }
    }

    if (ext === '.docx') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || '';
      } catch (docxErr) {
        console.warn(`DOCX extraction warning for ${originalName}:`, docxErr.message);
        return '';
      }
    }

    // Default attempt: UTF-8 read if mimetype looks like text
    if (mimetype && (mimetype.startsWith('text/') || mimetype.includes('json') || mimetype.includes('xml'))) {
      return fs.readFileSync(filePath, 'utf8');
    }

    return '';
  } catch (err) {
    console.error(`Failed to extract text from ${originalName}:`, err);
    return '';
  }
}

module.exports = { extractText };
