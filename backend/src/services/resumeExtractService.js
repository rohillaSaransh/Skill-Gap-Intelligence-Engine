/**
 * Extract raw text from resume file (PDF or DOCX).
 */
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - e.g. application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
 * @returns {Promise<string>} Raw text
 */
async function extractTextFromBuffer(buffer, mimeType) {
  const isPdf = mimeType === 'application/pdf';
  const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isPdf) {
    const data = await pdfParse(buffer);
    return data.text || '';
  }
  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  throw new Error('Unsupported file type. Use PDF or DOCX.');
}

module.exports = { extractTextFromBuffer };
