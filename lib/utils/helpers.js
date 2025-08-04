"use strict";

class Helpers {
  /**
   * Detect file type from buffer
   */
  static detectFileType(buffer) {
    const uint8Array = new Uint8Array(buffer);

    // PDF signature
    if (uint8Array[0] === 0x25 && uint8Array[1] === 0x50 && uint8Array[2] === 0x44 && uint8Array[3] === 0x46) {
      return 'pdf';
    }

    // DOCX signature (ZIP-based)
    if (uint8Array[0] === 0x50 && uint8Array[1] === 0x4B) {
      return 'docx';
    }

    // DOC signature
    if (uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF) {
      return 'doc';
    }
    return 'unknown';
  }

  /**
   * Extract sections from text based on headers
   */
  static extractSections(text) {
    const sections = {};
    const lines = text.split('\n');
    let currentSection = 'general';
    let currentContent = [];
    const {
      SECTION_HEADERS
    } = require('./constants');
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) {
        currentContent.push('');
        return;
      }

      // Check if line is a section header
      let isHeader = false;
      Object.entries(SECTION_HEADERS).forEach(([sectionKey, pattern]) => {
        if (pattern.test(trimmedLine)) {
          // Save previous section
          if (currentContent.length > 0) {
            sections[currentSection] = currentContent.join('\n').trim();
          }
          currentSection = sectionKey.toLowerCase();
          currentContent = [];
          isHeader = true;
        }
      });
      if (!isHeader) {
        currentContent.push(line);
      }
    });

    // Save last section
    if (currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }
    return sections;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  static calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  static levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Extract keywords from text
   */
  static extractKeywords(text, minLength = 3, maxKeywords = 50) {
    if (!text) return [];

    // Common stop words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(word => word.length >= minLength && !stopWords.has(word) && !word.match(/^\d+$/));

    // Count word frequency
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Sort by frequency and return top keywords
    return Object.entries(frequency).sort(([, a], [, b]) => b - a).slice(0, maxKeywords).map(([word]) => word);
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(months) {
    if (!months || months < 1) return '';
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0 && remainingMonths > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    } else if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}`;
    } else {
      return `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
    }
  }

  /**
   * Clean and normalize text
   */
  static cleanText(text) {
    if (!text) return '';
    return text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Extract matches using regex
   */
  static extractMatches(text, pattern) {
    if (!text || !pattern) return [];
    const matches = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push(match[0]);
    }
    return [...new Set(matches)]; // Remove duplicates
  }
}
module.exports = Helpers;