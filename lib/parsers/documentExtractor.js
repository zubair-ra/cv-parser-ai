"use strict";

const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
class DocumentExtractor {
  /**
   * Extract text from various document formats
   */
  static async extractText(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const extension = filePath.split('.').pop().toLowerCase();
      switch (extension) {
        case 'pdf':
          return await this.extractFromPDF(buffer);
        case 'docx':
        case 'doc':
          return await this.extractFromDOCX(buffer);
        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  /**
   * Extract text from buffer (for uploaded files)
   */
  static async extractTextFromBuffer(buffer, fileType) {
    try {
      switch (fileType.toLowerCase()) {
        case 'pdf':
          return await this.extractFromPDF(buffer);
        case 'docx':
        case 'doc':
          return await this.extractFromDOCX(buffer);
        default:
          throw new Error(`Unsupported file format: ${fileType}`);
      }
    } catch (error) {
      throw new Error(`Failed to extract text from buffer: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF
   */
  static async extractFromPDF(buffer) {
    try {
      const data = await pdfParse(buffer);
      return {
        text: data.text,
        pages: data.numpages,
        metadata: data.info
      };
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX
   */
  static async extractFromDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({
        buffer
      });
      return {
        text: result.value,
        messages: result.messages
      };
    } catch (error) {
      throw new Error(`DOCX extraction failed: ${error.message}`);
    }
  }

  /**
   * Clean and preprocess extracted text
   */
  static preprocessText(extractedData) {
    let text = extractedData.text || '';

    // Clean up common formatting issues
    text = text.replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/\s{2,}/g, ' ') // Multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double newline
    .trim();
    return {
      ...extractedData,
      text,
      cleanText: text,
      wordCount: text.split(/\s+/).length,
      lineCount: text.split('\n').length
    };
  }
}
module.exports = DocumentExtractor;