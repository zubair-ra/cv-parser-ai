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
 * Provides flexible CV parsing with customizable schemas and multiple AI providers
 */
class CVParser {
  constructor(options = {}) {
    // Validate required options
    if (!options.apiKey) {
      throw new CVParserError('AI API key is required');
    }

    // Validate and set provider
    this.provider = (options.provider || 'gemini').toLowerCase();
    this.validateProvider(this.provider);
    console.log(`Initializing CV Parser with provider: ${this.provider}`);

    // Initialize AI processor with provider support
    this.aiProcessor = new AIProcessor(options.apiKey, {
      provider: this.provider,
      model: options.model || AIProcessor.getRecommendedModel(this.provider),
      temperature: options.temperature || 0.1
    });

    // Set schema (default or custom)
    this.schema = options.schema || new CVSchema();
    this.validator = new DataValidator(this.schema);

    // Parser options with enhanced defaults
    this.options = {
      includeMetadata: options.includeMetadata !== false,
      includeKeywords: options.includeKeywords !== false,
      validateData: options.validateData !== false,
      normalizeData: options.normalizeData !== false,
      strictValidation: options.strictValidation || false,
      confidenceThreshold: options.confidenceThreshold || 0.5,
      retryOnFailure: options.retryOnFailure !== false,
      maxRetries: options.maxRetries || 2,
      parsingLevel: options.parsingLevel || 'moderate',
      // New parsing level option
      ...options
    };
    console.log('CV Parser initialized successfully');
  }

  /**
   * Validate if provider is supported
   */
  validateProvider(provider) {
    const availableProviders = AIProcessor.getAvailableProviders();
    if (!availableProviders.includes(provider)) {
      const supportedList = availableProviders.join(', ');
      throw new CVParserError(`Provider '${provider}' is not supported or not installed. ` + `Available providers: ${supportedList}. ` + `Install missing providers with: npm install openai @anthropic-ai/sdk`);
    }
  }

  /**
   * Parse CV from file path
   */
  async parse(filePath, options = {}) {
    console.log(`Parsing CV from file: ${filePath}`);
    try {
      const mergedOptions = {
        ...this.options,
        ...options
      };

      // Extract text from document
      console.log('Extracting text from document...');
      const extractedData = await DocumentExtractor.extractText(filePath);
      const preprocessedData = DocumentExtractor.preprocessText(extractedData);
      console.log(`Extracted ${preprocessedData.wordCount} words from document`);

      // Process with AI (with retry logic)
      const aiResult = await this._processWithRetry(preprocessedData.text, mergedOptions);
      if (!aiResult.success) {
        throw new AIProcessingError(aiResult.error);
      }

      // Post-process the results
      console.log('Post-processing results...');
      const finalResult = await this._postProcessResults(aiResult.data, preprocessedData, mergedOptions);
      console.log('✅ CV parsing completed successfully');
      return finalResult;
    } catch (error) {
      console.error('❌ CV parsing failed:', error.message);
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
    console.log(`Parsing CV from buffer, type: ${fileType}`);
    try {
      const mergedOptions = {
        ...this.options,
        ...options
      };

      // Auto-detect file type if not provided
      if (!fileType) {
        fileType = Helpers.detectFileType(buffer);
        console.log(`Auto-detected file type: ${fileType}`);
      }

      // Extract text from buffer
      console.log('Extracting text from buffer...');
      const extractedData = await DocumentExtractor.extractTextFromBuffer(buffer, fileType);
      const preprocessedData = DocumentExtractor.preprocessText(extractedData);
      console.log(`Extracted ${preprocessedData.wordCount} words from buffer`);

      // Process with AI (with retry logic)
      const aiResult = await this._processWithRetry(preprocessedData.text, mergedOptions);
      if (!aiResult.success) {
        throw new AIProcessingError(aiResult.error);
      }

      // Post-process the results
      console.log('Post-processing results...');
      const finalResult = await this._postProcessResults(aiResult.data, preprocessedData, mergedOptions);
      console.log('✅ CV parsing from buffer completed successfully');
      return finalResult;
    } catch (error) {
      console.error('❌ CV parsing from buffer failed:', error.message);
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
    console.log(`Starting batch processing of ${files.length} files`);
    const results = [];
    const mergedOptions = {
      ...this.options,
      ...options
    };
    let successCount = 0;
    let failureCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name || file || `file-${i + 1}`;
      console.log(`Processing file ${i + 1}/${files.length}: ${fileName}`);
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
          file: fileName,
          index: i
        });
        successCount++;
        console.log(`✅ Successfully processed: ${fileName}`);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          file: fileName,
          index: i
        });
        failureCount++;
        console.error(`❌ Failed to process: ${fileName} - ${error.message}`);
      }
    }
    console.log(`Batch processing completed. Success: ${successCount}, Failed: ${failureCount}`);
    return {
      results,
      summary: {
        total: files.length,
        successful: successCount,
        failed: failureCount,
        successRate: Math.round(successCount / files.length * 100)
      }
    };
  }

  /**
   * Process with AI with retry logic
   */
  async _processWithRetry(text, options) {
    let lastError;
    const maxRetries = options.retryOnFailure ? options.maxRetries : 0;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${maxRetries}`);
          // Add small delay between retries
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        // For backward compatibility, only use parsing level if explicitly set
        const level = options.parsingLevel || (this.options.parsingLevel !== 'moderate' ? this.options.parsingLevel : null);
        const aiResult = await this.aiProcessor.processWithSchema(text, this.schema, level);
        if (aiResult.success) {
          if (attempt > 0) {
            console.log(`✅ Succeeded on retry attempt ${attempt}`);
          }
          return aiResult;
        } else {
          lastError = new Error(aiResult.error);
        }
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt + 1} failed:`, error.message);
      }
    }
    throw lastError;
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
      console.log('Validating extracted data...');
      const validationResult = this.validator.validate(processedData);
      if (!validationResult.isValid) {
        console.warn('Validation warnings:', validationResult.warnings);
        console.warn('Validation errors:', validationResult.errors);
        if (options.strictValidation) {
          throw new ValidationError(`Validation failed: ${validationResult.errors.join(', ')}`);
        }
      }
      processedData = validationResult.data;
    }

    // Normalize data if enabled
    if (options.normalizeData) {
      console.log('Normalizing data...');
      processedData = this._normalizeData(processedData);
    }

    // Add metadata if enabled
    if (options.includeMetadata) {
      const confidence = this._calculateOverallConfidence(processedData);
      processedData.metadata = {
        parseDate: new Date().toISOString(),
        parseConfidence: confidence,
        provider: this.provider,
        model: this.aiProcessor.model,
        wordCount: extractedData.wordCount,
        lineCount: extractedData.lineCount,
        processingTime: Date.now(),
        // Can be enhanced to track actual time
        ...(processedData.metadata || {})
      };
      console.log(`Parse confidence: ${Math.round(confidence * 100)}%`);
    }

    // Add keywords if enabled
    if (options.includeKeywords) {
      console.log('Extracting keywords...');
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
      console.warn(`⚠️ Parse confidence (${Math.round(confidence * 100)}%) below threshold (${Math.round(options.confidenceThreshold * 100)}%)`);
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
      if (normalized.personal.github) {
        normalized.personal.github = FieldNormalizer.normalizeURL(normalized.personal.github);
      }
      if (normalized.personal.website) {
        normalized.personal.website = FieldNormalizer.normalizeURL(normalized.personal.website);
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

    // Normalize certifications
    if (normalized.certifications && Array.isArray(normalized.certifications)) {
      normalized.certifications = normalized.certifications.map(cert => ({
        ...cert,
        issueDate: cert.issueDate ? FieldNormalizer.normalizeDate(cert.issueDate) : null,
        expiryDate: cert.expiryDate ? FieldNormalizer.normalizeDate(cert.expiryDate) : null,
        url: cert.url ? FieldNormalizer.normalizeURL(cert.url) : null
      }));
    }
    return normalized;
  }

  /**
   * Calculate overall confidence score
   */
  _calculateOverallConfidence(data) {
    let score = 0;
    let maxScore = 0;

    // Personal information (40% weight)
    if (data.personal) {
      if (data.personal.fullName) score += 15;
      if (data.personal.email) score += 15;
      if (data.personal.phone) score += 10;
      maxScore += 40;
    }

    // Experience (30% weight)
    if (data.experience && Array.isArray(data.experience) && data.experience.length > 0) {
      const expScore = Math.min(data.experience.length * 10, 30);
      score += expScore;
      maxScore += 30;
    }

    // Education (15% weight) 
    if (data.education && Array.isArray(data.education) && data.education.length > 0) {
      const eduScore = Math.min(data.education.length * 7.5, 15);
      score += eduScore;
      maxScore += 15;
    }

    // Skills (15% weight)
    if (data.skills && (data.skills.technical || data.skills.soft)) {
      score += 15;
      maxScore += 15;
    }
    return maxScore > 0 ? Math.round(score / maxScore * 100) / 100 : 0;
  }

  /**
   * Get parser information and capabilities
   */
  getInfo() {
    return {
      provider: this.provider,
      model: this.aiProcessor.model,
      availableProviders: AIProcessor.getAvailableProviders(),
      parsingLevels: AIProcessor.getParsingLevels(),
      schema: this.schema.getRequiredFields(),
      options: this.options
    };
  }

  /**
   * Static method to get available providers
   */
  static getAvailableProviders() {
    return AIProcessor.getAvailableProviders();
  }

  /**
   * Static method to get parsing levels
   */
  static getParsingLevels() {
    return AIProcessor.getParsingLevels();
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

  /**
   * Static method to create parser with specific provider
   */
  static withProvider(provider, options = {}) {
    return new CVParser({
      ...options,
      provider: provider
    });
  }

  /**
   * Static method for quick parsing with sensible defaults
   */
  static async quickParse(filePath, apiKey, provider = 'gemini') {
    const parser = new CVParser({
      apiKey,
      provider,
      includeMetadata: true,
      normalizeData: true
    });
    return await parser.parse(filePath);
  }

  /**
   * Static method for fast parsing with low parsing level
   */
  static async fastParse(filePath, apiKey, provider = 'groq') {
    const parser = new CVParser({
      apiKey,
      provider,
      parsingLevel: 'low',
      includeMetadata: false,
      includeKeywords: false,
      normalizeData: false
    });
    return await parser.parse(filePath);
  }

  /**
   * Static method for detailed parsing with high level
   */
  static async detailedParse(filePath, apiKey, provider = 'gemini') {
    const parser = new CVParser({
      apiKey,
      provider,
      parsingLevel: 'high',
      includeMetadata: true,
      normalizeData: true,
      validateData: true
    });
    return await parser.parse(filePath);
  }
}

// Export main class and utilities
module.exports = CVParser;
module.exports.CVSchema = CVSchema;
module.exports.FIELD_TYPES = require('./schemas/fieldTypes').FIELD_TYPES;
module.exports.DocumentExtractor = DocumentExtractor;
module.exports.AIProcessor = AIProcessor;
module.exports.DataValidator = DataValidator;
module.exports.FieldNormalizer = FieldNormalizer;
module.exports.Helpers = Helpers;
module.exports.errors = require('./utils/errors');