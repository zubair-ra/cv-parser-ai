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
   * Clean and preprocess extracted text with performance optimizations
   */
  static preprocessText(extractedData) {
    let text = extractedData.text || '';

    // Early return for empty text
    if (!text || text.length === 0) {
      return {
        ...extractedData,
        text: '',
        cleanText: '',
        wordCount: 0,
        lineCount: 0
      };
    }

    // Performance optimization: limit text length early for huge files
    if (text.length > 50000) {
      text = text.substring(0, 50000);
    }

    // Clean up common formatting issues in one pass for better performance
    text = text.replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/\s{2,}/g, ' ') // Multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double newline
    .replace(/Page \d+ of \d+/g, '') // Remove page numbers
    .replace(/References available upon request/gi, '') // Remove common footer
    .trim();

    // Fast word and line counting
    const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
    const lineCount = text ? text.split('\n').length : 0;
    return {
      ...extractedData,
      text,
      cleanText: text,
      wordCount,
      lineCount,
      isLarge: text.length > 10000 // Flag for large documents
    };
  }

  /**
   * Fast text extraction for basic info only (performance mode)
   */
  static fastExtractBasicInfo(text) {
    var _snippet$match, _snippet$match2, _snippet$split$;
    if (!text || text.length === 0) return {};

    // Get first 1000 characters for basic info extraction
    const snippet = text.substring(0, 1000);
    return {
      email: ((_snippet$match = snippet.match(/[\w.-]+@[\w.-]+\.\w+/)) === null || _snippet$match === void 0 ? void 0 : _snippet$match[0]) || null,
      phone: ((_snippet$match2 = snippet.match(/[\+\d][\d\s\-\(\)]{8,20}\d/)) === null || _snippet$match2 === void 0 ? void 0 : _snippet$match2[0]) || null,
      name: ((_snippet$split$ = snippet.split('\n')[0]) === null || _snippet$split$ === void 0 ? void 0 : _snippet$split$.trim()) || null
    };
  }
}
module.exports = DocumentExtractor;