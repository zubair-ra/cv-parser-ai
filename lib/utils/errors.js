"use strict";

class CVParserError extends Error {
  constructor(message, code = 'CV_PARSER_ERROR') {
    super(message);
    this.name = 'CVParserError';
    this.code = code;
  }
}
class DocumentExtractionError extends CVParserError {
  constructor(message, fileType = null) {
    super(message, 'DOCUMENT_EXTRACTION_ERROR');
    this.name = 'DocumentExtractionError';
    this.fileType = fileType;
  }
}
class AIProcessingError extends CVParserError {
  constructor(message, aiProvider = null) {
    super(message, 'AI_PROCESSING_ERROR');
    this.name = 'AIProcessingError';
    this.aiProvider = aiProvider;
  }
}
class ValidationError extends CVParserError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}
class SchemaError extends CVParserError {
  constructor(message) {
    super(message, 'SCHEMA_ERROR');
    this.name = 'SchemaError';
  }
}
module.exports = {
  CVParserError,
  DocumentExtractionError,
  AIProcessingError,
  ValidationError,
  SchemaError
};