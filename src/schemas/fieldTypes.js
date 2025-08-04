const FIELD_TYPES = {
  // Basic types
  STRING: 'string',
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  DATE: 'date',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  
  // Complex types
  ARRAY: 'array',
  OBJECT: 'object',
  
  // Specialized CV types
  NAME: 'name',
  ADDRESS: 'address',
  SKILL_LIST: 'skill_list',
  EXPERIENCE: 'experience',
  EDUCATION: 'education',
  LANGUAGE: 'language',
  CERTIFICATION: 'certification'
};

const FIELD_CONFIGS = {
  [FIELD_TYPES.STRING]: {
    validator: (value) => typeof value === 'string',
    normalizer: (value) => value?.toString().trim()
  },
  
  [FIELD_TYPES.EMAIL]: {
    validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    normalizer: (value) => value?.toString().toLowerCase().trim()
  },
  
  [FIELD_TYPES.PHONE]: {
    validator: (value) => /^[\+]?[1-9][\d]{0,15}$/.test(value?.replace(/[\s\-\(\)]/g, '')),
    normalizer: (value) => value?.toString().replace(/[\s\-\(\)]/g, '')
  },
  
  [FIELD_TYPES.URL]: {
    validator: (value) => {
      try { new URL(value); return true; } catch { return false; }
    },
    normalizer: (value) => value?.toString().trim()
  },
  
  [FIELD_TYPES.DATE]: {
    validator: (value) => !isNaN(Date.parse(value)),
    normalizer: (value) => new Date(value).toISOString().split('T')[0]
  },
  
  [FIELD_TYPES.ARRAY]: {
    validator: (value) => Array.isArray(value),
    normalizer: (value) => Array.isArray(value) ? value : [value].filter(Boolean)
  }
};

module.exports = {
  FIELD_TYPES,
  FIELD_CONFIGS
};