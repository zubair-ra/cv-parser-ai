"use strict";

const {
  GoogleGenerativeAI
} = require('@google/generative-ai');
class AIProcessor {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('AI API key is required');
    }
    console.log('Initializing AI Processor with API Key:', apiKey);
    console.log('Using Model:', options.model || 'gemini-1.5-flash');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: options.model || "gemini-1.5-flash"
    });
    this.options = options;
  }

  /**
   * Process CV text with AI based on schema
   */
  async processWithSchema(text, schema) {
    try {
      const prompt = this.buildPrompt(text, schema);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();
      return this.parseAIResponse(generatedText);
    } catch (error) {
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Build AI prompt based on schema requirements
   */
  buildPrompt(text, schema) {
    const schemaFields = this.extractSchemaFields(schema.schema);
    return `
You are a professional CV/Resume parser. Extract the following information from the provided CV text and return it as a valid JSON object.

REQUIRED FIELDS TO EXTRACT:
${this.formatSchemaForPrompt(schemaFields)}

IMPORTANT INSTRUCTIONS:
1. Extract only the information that is explicitly present in the CV
2. Return valid JSON format only
3. Use null for missing optional fields
4. For dates, use YYYY-MM-DD format or YYYY-MM if day is not specified
5. For arrays, extract all relevant items
6. For skills, separate technical skills from soft skills
7. For experience, include all job positions with as much detail as available
8. For education, include all educational qualifications

CV TEXT TO PARSE:
${text}

Return only the JSON object, no additional text or explanation:
`;
  }

  /**
   * Extract fields from schema for prompt building
   */
  extractSchemaFields(schema, path = '') {
    const fields = {};
    Object.entries(schema).forEach(([key, config]) => {
      const currentPath = path ? `${path}.${key}` : key;
      if (config.fields) {
        fields[currentPath] = {
          type: config.type,
          required: config.required,
          fields: this.extractSchemaFields(config.fields, currentPath)
        };
      } else {
        fields[currentPath] = {
          type: config.type,
          required: config.required
        };
      }
    });
    return fields;
  }

  /**
   * Format schema fields for AI prompt
   */
  formatSchemaForPrompt(fields) {
    let prompt = '';
    Object.entries(fields).forEach(([path, config]) => {
      const required = config.required ? '(REQUIRED)' : '(OPTIONAL)';
      prompt += `- ${path}: ${config.type} ${required}\n`;
      if (config.fields) {
        Object.entries(config.fields).forEach(([subKey, subConfig]) => {
          const subRequired = subConfig.required ? '(REQUIRED)' : '(OPTIONAL)';
          prompt += `  - ${subKey}: ${subConfig.type} ${subRequired}\n`;
        });
      }
    });
    return prompt;
  }

  /**
   * Parse AI response to JSON
   */
  parseAIResponse(response) {
    try {
      // Clean the response
      let cleanResponse = response.trim();

      // Remove markdown code blocks if present
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Parse JSON
      const parsed = JSON.parse(cleanResponse);
      return {
        success: true,
        data: parsed,
        confidence: this.calculateConfidence(parsed)
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse AI response: ${error.message}`,
        rawResponse: response
      };
    }
  }

  /**
   * Calculate confidence score based on extracted data
   */
  calculateConfidence(data) {
    let score = 0;
    let maxScore = 0;

    // Check personal information
    if (data.personal) {
      if (data.personal.fullName) score += 20;
      if (data.personal.email) score += 20;
      if (data.personal.phone) score += 10;
      maxScore += 50;
    }

    // Check experience
    if (data.experience && Array.isArray(data.experience) && data.experience.length > 0) {
      score += Math.min(data.experience.length * 10, 30);
      maxScore += 30;
    }

    // Check education
    if (data.education && Array.isArray(data.education) && data.education.length > 0) {
      score += Math.min(data.education.length * 5, 10);
      maxScore += 10;
    }

    // Check skills
    if (data.skills && (data.skills.technical || data.skills.soft)) {
      score += 10;
      maxScore += 10;
    }
    return maxScore > 0 ? Math.round(score / maxScore * 100) / 100 : 0;
  }
}
module.exports = AIProcessor;