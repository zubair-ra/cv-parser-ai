"use strict";

const DocumentExtractor = require('./parsers/documentExtractor');
const AIProcessor = require('./parsers/aiProcessor');
const DataValidator = require('./validators/dataValidator');
const FieldNormalizer = require('./validators/fieldNormalizer');
const CVSchema = require('./schemas/CVSchema');
const Helpers = require('./utils/helpers');
const {
  CVParserError,
  DocumentExtractionError,
  AIProcessingError,
  ValidationError
} = require('./utils/errors');

/**
 * Main CV Parser Class
 * Provides flexible CV parsing with customizable schemas
 */
class CVParser {
  constructor(options = {}) {
    // Validate required options
    if (!options.apiKey) {
      throw new CVParserError('AI API key is required');
    }

    // Initialize components
    this.aiProcessor = new AIProcessor(options.apiKey, {
      model: options.model || 'gemini-pro',
      temperature: options.temperature || 0.1
    });

    // Set schema (default or custom)
    this.schema = options.schema || new CVSchema();
    this.validator = new DataValidator(this.schema);

    // Parser options
    this.options = {
      includeMetadata: options.includeMetadata !== false,
      includeKeywords: options.includeKeywords !== false,
      validateData: options.validateData !== false,
      normalizeData: options.normalizeData !== false,
      confidenceThreshold: options.confidenceThreshold || 0.5,
      ...options
    };
  }

  /**
   * Parse CV from file path
   */
  async parse(filePath, options = {}) {
    try {
      const mergedOptions = {
        ...this.options,
        ...options
      };

      // Extract text from document
      const extractedData = await DocumentExtractor.extractText(filePath);
      const preprocessedData = DocumentExtractor.preprocessText(extractedData);

      // Process with AI
      const aiResult = await this.aiProcessor.processWithSchema(preprocessedData.text, this.schema);
      if (!aiResult.success) {
        throw new AIProcessingError(aiResult.error);
      }

      // Post-process the results
      return await this._postProcessResults(aiResult.data, preprocessedData, mergedOptions);
    } catch (error) {
      if (error instanceof CVParserError) {
        throw error;
      }
      throw new CVParserError(`Failed to parse CV: ${error.message}`);
    }
  }

  /**
   * Parse CV from buffer (for file uploads)
   */
  async parseBuffer(buffer, fileType, options = {}) {
    try {
      const mergedOptions = {
        ...this.options,
        ...options
      };

      // Auto-detect file type if not provided
      if (!fileType) {
        fileType = Helpers.detectFileType(buffer);
      }

      // Extract text from buffer
      const extractedData = await DocumentExtractor.extractTextFromBuffer(buffer, fileType);
      const preprocessedData = DocumentExtractor.preprocessText(extractedData);

      // Process with AI
      const aiResult = await this.aiProcessor.processWithSchema(preprocessedData.text, this.schema);
      if (!aiResult.success) {
        throw new AIProcessingError(aiResult.error);
      }

      // Post-process the results
      return await this._postProcessResults(aiResult.data, preprocessedData, mergedOptions);
    } catch (error) {
      if (error instanceof CVParserError) {
        throw error;
      }
      throw new CVParserError(`Failed to parse CV from buffer: ${error.message}`);
    }
  }

  /**
   * Parse multiple CVs in batch
   */
  async parseBatch(files, options = {}) {
    const results = [];
    const mergedOptions = {
      ...this.options,
      ...options
    };
    for (const file of files) {
      try {
        let result;
        if (typeof file === 'string') {
          // File path
          result = await this.parse(file, mergedOptions);
        } else if (file.buffer && file.type) {
          // Buffer with type
          result = await this.parseBuffer(file.buffer, file.type, mergedOptions);
        } else {
          throw new CVParserError('Invalid file format in batch');
        }
        results.push({
          success: true,
          data: result,
          file: file.name || file
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          file: file.name || file
        });
      }
    }
    return results;
  }

  /**
   * Post-process AI results
   */
  async _postProcessResults(data, extractedData, options) {
    var _processedData$metada;
    let processedData = {
      ...data
    };

    // Validate data if enabled
    if (options.validateData) {
      const validationResult = this.validator.validate(processedData);
      if (!validationResult.isValid && options.strictValidation) {
        throw new ValidationError(`Validation failed: ${validationResult.errors.join(', ')}`);
      }
      processedData = validationResult.data;
    }

    // Normalize data if enabled
    if (options.normalizeData) {
      processedData = this._normalizeData(processedData);
    }

    // Add metadata if enabled
    if (options.includeMetadata) {
      processedData.metadata = {
        parseDate: new Date().toISOString(),
        parseConfidence: this._calculateOverallConfidence(processedData),
        wordCount: extractedData.wordCount,
        lineCount: extractedData.lineCount,
        ...(processedData.metadata || {})
      };
    }

    // Add keywords if enabled
    if (options.includeKeywords) {
      const keywords = Helpers.extractKeywords(extractedData.text);
      if (processedData.metadata) {
        processedData.metadata.keywords = keywords;
      } else {
        processedData.keywords = keywords;
      }
    }

    // Check confidence threshold
    const confidence = ((_processedData$metada = processedData.metadata) === null || _processedData$metada === void 0 ? void 0 : _processedData$metada.parseConfidence) || 0;
    if (confidence < options.confidenceThreshold) {
      console.warn(`Parse confidence (${confidence}) below threshold (${options.confidenceThreshold})`);
    }
    return processedData;
  }

  /**
   * Normalize parsed data
   */
  _normalizeData(data) {
    const normalized = {
      ...data
    };

    // Normalize personal information
    if (normalized.personal) {
      if (normalized.personal.email) {
        normalized.personal.email = FieldNormalizer.normalizeEmail(normalized.personal.email);
      }
      if (normalized.personal.phone) {
        normalized.personal.phone = FieldNormalizer.normalizePhone(normalized.personal.phone);
      }
      if (normalized.personal.fullName) {
        normalized.personal.fullName = FieldNormalizer.normalizeName(normalized.personal.fullName);
      }
      if (normalized.personal.linkedIn) {
        normalized.personal.linkedIn = FieldNormalizer.normalizeURL(normalized.personal.linkedIn);
      }
    }

    // Normalize experience dates and calculate durations
    if (normalized.experience && Array.isArray(normalized.experience)) {
      normalized.experience = normalized.experience.map(exp => ({
        ...exp,
        startDate: exp.startDate ? FieldNormalizer.normalizeDate(exp.startDate) : null,
        endDate: exp.endDate ? FieldNormalizer.normalizeDate(exp.endDate) : null,
        duration: FieldNormalizer.calculateDuration(exp.startDate, exp.endDate)
      }));
    }

    // Normalize education dates
    if (normalized.education && Array.isArray(normalized.education)) {
      normalized.education = normalized.education.map(edu => ({
        ...edu,
        startDate: edu.startDate ? FieldNormalizer.normalizeDate(edu.startDate) : null,
        endDate: edu.endDate ? FieldNormalizer.normalizeDate(edu.endDate) : null
      }));
    }

    // Normalize skills
    if (normalized.skills) {
      Object.keys(normalized.skills).forEach(key => {
        if (Array.isArray(normalized.skills[key])) {
          normalized.skills[key] = FieldNormalizer.normalizeSkills(normalized.skills[key]);
        }
      });
    }
    return normalized;
  }

  /**
   * Calculate overall confidence score
   */
  _calculateOverallConfidence(data) {
    let score = 0;
    let maxScore = 0;

    // Personal information (40%)
    if (data.personal) {
      if (data.personal.fullName) score += 15;
      if (data.personal.email) score += 15;
      if (data.personal.phone) score += 10;
      maxScore += 40;
    }

    // Experience (30%)
    if (data.experience && Array.isArray(data.experience) && data.experience.length > 0) {
      score += Math.min(data.experience.length * 10, 30);
      maxScore += 30;
    }

    // Education (15%)
    if (data.education && Array.isArray(data.education) && data.education.length > 0) {
      score += Math.min(data.education.length * 7.5, 15);
      maxScore += 15;
    }

    // Skills (15%)
    if (data.skills && (data.skills.technical || data.skills.soft)) {
      score += 15;
      maxScore += 15;
    }
    return maxScore > 0 ? Math.round(score / maxScore * 100) / 100 : 0;
  }

  /**
   * Static method to create parser with custom schema
   */
  static withSchema(schema, options = {}) {
    return new CVParser({
      ...options,
      schema: schema
    });
  }

  /**
   * Static method to create parser with minimal schema
   */
  static minimal(options = {}) {
    return new CVParser({
      ...options,
      schema: CVSchema.getMinimalSchema()
    });
  }

  /**
   * Static method to create parser optimized for ATS
   */
  static forATS(options = {}) {
    return new CVParser({
      ...options,
      schema: CVSchema.getATSSchema()
    });
  }
}
module.exports = CVParser;
module.exports.CVSchema = CVSchema;
module.exports.FIELD_TYPES = require('./schemas/fieldTypes').FIELD_TYPES;
module.exports.DocumentExtractor = DocumentExtractor;
module.exports.AIProcessor = AIProcessor;
module.exports.DataValidator = DataValidator;
module.exports.FieldNormalizer = FieldNormalizer;
module.exports.Helpers = Helpers;
module.exports.errors = require('./utils/errors');