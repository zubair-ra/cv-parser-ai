const { FIELD_CONFIGS } = require('../schemas/fieldTypes');

class DataValidator {
  constructor(schema) {
    this.schema = schema;
  }

  /**
   * Validate extracted data against schema
   */
  validate(data) {
    const errors = [];
    const warnings = [];
    const validatedData = {};

    try {
      this._validateObject(data, this.schema.schema, '', validatedData, errors, warnings);
      
      return {
        isValid: errors.length === 0,
        data: validatedData,
        errors,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        data: {},
        errors: [`Validation failed: ${error.message}`],
        warnings
      };
    }
  }

  /**
   * Validate object recursively
   */
  _validateObject(data, schema, path, result, errors, warnings) {
    Object.entries(schema).forEach(([key, config]) => {
      const currentPath = path ? `${path}.${key}` : key;
      const value = data[key];

      if (config.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required field missing: ${currentPath}`);
        return;
      }

      if (value !== undefined && value !== null && value !== '') {
        try {
          const validatedValue = this._validateField(value, config, currentPath, errors, warnings);
          this._setNestedValue(result, key, validatedValue);
        } catch (error) {
          errors.push(`Validation error for ${currentPath}: ${error.message}`);
        }
      } else if (!config.required) {
        this._setNestedValue(result, key, null);
      }
    });
  }

  /**
   * Validate individual field
   */
  _validateField(value, config, path, errors, warnings) {
    const fieldConfig = FIELD_CONFIGS[config.type];

    if (config.type === 'array') {
      if (!Array.isArray(value)) {
        warnings.push(`Converting non-array to array for ${path}`);
        value = [value];
      }

      if (config.fields) {
        return value.map((item, index) => {
          const itemResult = {};
          const itemErrors = [];
          const itemWarnings = [];
          this._validateObject(item, config.fields, `${path}[${index}]`, itemResult, itemErrors, itemWarnings);
          errors.push(...itemErrors);
          warnings.push(...itemWarnings);
          return itemResult;
        });
      }

      return value;
    }

    if (config.type === 'object' && config.fields) {
      const objectResult = {};
      const objectErrors = [];
      const objectWarnings = [];
      this._validateObject(value, config.fields, path, objectResult, objectErrors, objectWarnings);
      errors.push(...objectErrors);
      warnings.push(...objectWarnings);
      return objectResult;
    }

    // Apply field-specific validation and normalization
    if (fieldConfig) {
      if (fieldConfig.validator && !fieldConfig.validator(value)) {
        warnings.push(`Invalid format for ${path}: ${value}`);
      }

      if (fieldConfig.normalizer) {
        return fieldConfig.normalizer(value);
      }
    }

    return value;
  }

  /**
   * Set nested value in result object
   */
  _setNestedValue(obj, key, value) {
    obj[key] = value;
  }

  /**
   * Validate specific field types
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  static validateURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static validateDate(date) {
    return !isNaN(Date.parse(date));
  }
}

module.exports = DataValidator;
