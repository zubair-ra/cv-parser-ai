"use strict";

const {
  GoogleGenerativeAI
} = require('@google/generative-ai');
class AIProcessor {
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error('AI API key is required');
    }
    this.apiKey = apiKey;
    this.provider = (options.provider || 'gemini').toLowerCase();
    this.model = options.model;
    this.options = options;

    // Initialize the selected provider
    this.initializeProvider();
  }

  /**
   * Initialize AI provider based on selection
   */
  initializeProvider() {
    switch (this.provider) {
      case 'gemini':
      case 'google':
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.model || 'gemini-1.5-flash';
        this.client = this.genAI.getGenerativeModel({
          model: this.model
        });
        console.log('Using Gemini Model:', this.model);
        break;
      case 'openai':
        this.model = this.model || 'gpt-3.5-turbo';
        console.log('Using OpenAI Model:', this.model);
        // Initialize OpenAI client when available
        this.initializeOpenAI();
        break;
      case 'claude':
      case 'anthropic':
        this.model = this.model || 'claude-3-haiku-20240307';
        console.log('Using Claude Model:', this.model);
        // Initialize Anthropic client when available
        this.initializeClaude();
        break;
      case 'groq':
        this.model = this.model || 'llama3-8b-8192';
        console.log('Using Groq Model:', this.model);
        this.initializeGroq();
        break;
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}. Supported providers: gemini, openai, claude, groq`);
    }
  }

  /**
   * Initialize OpenAI client
   */
  initializeOpenAI() {
    try {
      const {
        OpenAI
      } = require('openai');
      this.client = new OpenAI({
        apiKey: this.apiKey
      });
      console.log('OpenAI client initialized successfully');
    } catch (error) {
      throw new Error('OpenAI package not found. Install with: npm install openai');
    }
  }

  /**
   * Initialize Claude/Anthropic client
   */
  initializeClaude() {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({
        apiKey: this.apiKey
      });
      console.log('Anthropic client initialized successfully');
    } catch (error) {
      throw new Error('Anthropic SDK not found. Install with: npm install @anthropic-ai/sdk');
    }
  }

  /**
   * Initialize Groq client
   */
  initializeGroq() {
    try {
      const Groq = require('groq-sdk');
      this.client = new Groq({
        apiKey: this.apiKey
      });
      console.log('Groq client initialized successfully');
    } catch (error) {
      throw new Error('Groq SDK not found. Install with: npm install groq-sdk');
    }
  }

  /**
   * Process CV text with AI based on schema and parsing level
   */
  async processWithSchema(text, schema, level) {
    try {
      // Always use original prompt quality for best results, just optimize compression
      const prompt = this.buildOptimizedPrompt(text, schema, level);
      switch (this.provider) {
        case 'gemini':
        case 'google':
          return await this.processWithGemini(prompt);
        case 'openai':
          return await this.processWithOpenAI(prompt);
        case 'claude':
        case 'anthropic':
          return await this.processWithClaude(prompt);
        case 'groq':
          return await this.processWithGroq(prompt);
        default:
          throw new Error(`Processing not implemented for provider: ${this.provider}`);
      }
    } catch (error) {
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Process with Google Gemini
   */
  async processWithGemini(prompt) {
    try {
      console.log('Processing with Gemini...');
      const result = await this.client.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();
      return this.parseAIResponse(generatedText);
    } catch (error) {
      throw new Error(`Gemini processing failed: ${error.message}`);
    }
  }

  /**
   * Process with OpenAI
   */
  async processWithOpenAI(prompt) {
    try {
      console.log('Processing with OpenAI...');
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{
          role: "system",
          content: "You are a professional CV/Resume parser. Extract information and return only valid JSON."
        }, {
          role: "user",
          content: prompt
        }],
        temperature: this.options.temperature || 0.1,
        max_tokens: 4000
      });
      const generatedText = completion.choices[0].message.content;
      return this.parseAIResponse(generatedText);
    } catch (error) {
      throw new Error(`OpenAI processing failed: ${error.message}`);
    }
  }

  /**
   * Process with Claude/Anthropic
   */
  async processWithClaude(prompt) {
    try {
      console.log('Processing with Claude...');
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: this.options.temperature || 0.1,
        messages: [{
          role: "user",
          content: prompt
        }]
      });
      const generatedText = message.content[0].text;
      return this.parseAIResponse(generatedText);
    } catch (error) {
      throw new Error(`Claude processing failed: ${error.message}`);
    }
  }

  /**
   * Process with Groq
   */
  async processWithGroq(prompt) {
    try {
      console.log('Processing with Groq...');
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{
          role: "system",
          content: "Extract CV data and return valid JSON only."
        }, {
          role: "user",
          content: prompt
        }],
        temperature: this.options.temperature || 0.1,
        max_tokens: 4000
      });
      const generatedText = completion.choices[0].message.content;
      return this.parseAIResponse(generatedText);
    } catch (error) {
      throw new Error(`Groq processing failed: ${error.message}`);
    }
  }

  /**
   * Build original AI prompt (for backward compatibility)
   */
  buildOriginalPrompt(text, schema) {
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
9. Do not include any explanatory text, only the JSON object
10. For the SUMMARY field: Look for professional summary, profile, or objective text which may appear:
    - Under headings like "SUMMARY", "PROFILE", "OBJECTIVE", "ABOUT", "PROFESSIONAL SUMMARY"
    - As a paragraph immediately after the name/contact info and before the first major section
    - As descriptive text about the person's professional background, skills overview, or career objectives
    - Even if there's no explicit heading, extract any introductory professional description

CV TEXT TO PARSE:
${text}

Return only the JSON object:
`;
  }

  /**
   * Build optimized prompt that maintains quality but allows compression
   */
  buildOptimizedPrompt(text, schema, level) {
    // If no level specified, use original behavior
    if (!level) {
      const prompt = this.buildOriginalPrompt(text, schema);
      // Store token info for analysis
      this.lastPromptInfo = {
        level: 'original',
        textLength: text.length,
        promptLength: prompt.length,
        estimatedTokens: Math.ceil(prompt.length / 4)
      };
      return prompt;
    }

    // Compress text based on level but keep original prompt quality
    const compressedText = this.smartCompressText(text, level);
    const schemaFields = this.extractSchemaFields(schema.schema);

    // Use original prompt structure with compressed text
    const prompt = `
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
9. Do not include any explanatory text, only the JSON object
10. For the SUMMARY field: Look for professional summary, profile, or objective text which may appear:
    - Under headings like "SUMMARY", "PROFILE", "OBJECTIVE", "ABOUT", "PROFESSIONAL SUMMARY"
    - As a paragraph immediately after the name/contact info and before the first major section
    - As descriptive text about the person's professional background, skills overview, or career objectives
    - Even if there's no explicit heading, extract any introductory professional description

CV TEXT TO PARSE:
${compressedText}

Return only the JSON object:
`;

    // Store token info for analysis
    this.lastPromptInfo = {
      level: level,
      originalTextLength: text.length,
      compressedTextLength: compressedText.length,
      promptLength: prompt.length,
      estimatedTokens: Math.ceil(prompt.length / 4),
      compressionRatio: Math.round((1 - compressedText.length / text.length) * 100)
    };
    return prompt;
  }

  /**
   * Build optimized AI prompt based on schema requirements and parsing level (DEPRECATED)
   */
  buildPrompt(text, schema, level = 'moderate') {
    // For 'ultra' level, use original prompt for best results
    if (level === 'ultra') {
      return this.buildOriginalPrompt(text, schema);
    }

    // Compress text based on parsing level for speed and cost optimization
    const compressedText = this.compressTextByLevel(text, level);
    const schemaFields = this.extractSchemaFields(schema.schema);

    // Get level-specific prompt
    const levelPrompt = this.getLevelPrompt(level, schemaFields);
    return `${levelPrompt}\n\nCV TEXT:\n${compressedText}\n\nReturn JSON:`;
  }

  /**
   * Smart text compression that maintains quality
   */
  smartCompressText(text, level) {
    // Clean common redundant content first
    let cleaned = text.replace(/Page \d+ of \d+/g, '').replace(/References available upon request/gi, '').replace(/\s{2,}/g, ' ').trim();
    switch (level) {
      case 'low':
        // Keep enough content for basic info - be less aggressive
        return cleaned.substring(0, 2000);
      case 'moderate':
        // Keep good amount for balanced parsing
        return cleaned.substring(0, 3500);
      case 'high':
        // Keep most content
        return cleaned.substring(0, 5000);
      case 'ultra':
        // Keep everything
        return cleaned;
      default:
        // Default to moderate
        return cleaned.substring(0, 3500);
    }
  }

  /**
   * Old compression method (kept for backward compatibility)
   */
  compressTextByLevel(text, level) {
    switch (level) {
      case 'low':
        // Keep first 1200 chars for basic info (increased from 800)
        return text.substring(0, 1200).replace(/Page \d+ of \d+/g, '').replace(/References available upon request/gi, '').replace(/\s+/g, ' ').trim();
      case 'moderate':
        // Keep first 2500 chars, remove redundant content (increased from 1500)
        return text.substring(0, 2500).replace(/Page \d+ of \d+/g, '').replace(/References available upon request/gi, '').replace(/\s+/g, ' ').trim();
      case 'high':
        // Keep more content but still optimize (increased from 3000)
        return text.substring(0, 4500).replace(/Page \d+ of \d+/g, '').replace(/References available upon request/gi, '').replace(/\s{2,}/g, ' ').trim();
      case 'ultra':
        // Full text with minimal compression
        return text.replace(/\s{3,}/g, ' ').trim();
      default:
        return text.substring(0, 2500).replace(/\s+/g, ' ').trim();
    }
  }

  /**
   * Get level-specific prompts
   */
  getLevelPrompt(level, schemaFields) {
    switch (level) {
      case 'low':
        return `Extract basic CV information as JSON:
{
  "personal": {
    "fullName": "Full Name",
    "firstName": "First",
    "lastName": "Last",
    "email": "email@example.com",
    "phone": "+1234567890"
  },
  "skills": {
    "technical": ["skill1", "skill2"]
  }
}

Instructions:
- Extract only name, email, phone, and main skills
- Use exact JSON structure above
- Use null for missing fields`;
      case 'moderate':
        return `Extract CV data as structured JSON with these sections:
- personal: {fullName, firstName, lastName, email, phone, address, linkedIn}
- experience: [{jobTitle, company, startDate, endDate, location, description}]
- education: [{institution, degree, fieldOfStudy, startDate, endDate}]
- skills: {technical: [], soft: []}

Instructions:
- Follow exact field names shown above
- Use null for missing fields
- Return valid JSON only`;
      case 'high':
        return `Professional CV parser. Extract detailed information in this JSON structure:
${this.formatSchemaForPrompt(schemaFields)}

Instructions:
- Extract all available data from CV
- Use proper field names as shown above
- Use null for missing fields
- For dates use YYYY-MM-DD format
- Return valid JSON only`;
      default:
        return this.getLevelPrompt('moderate', schemaFields);
    }
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
  formatSchemaForPrompt(fields, compact = false) {
    if (compact) {
      // Compact format for moderate parsing
      return Object.keys(fields).join(', ');
    }
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
      console.log('Raw AI Response:', response.substring(0, 200) + '...');

      // Clean the response
      let cleanResponse = response.trim();

      // Remove markdown code blocks if present
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Remove any text before the first {
      const jsonStart = cleanResponse.indexOf('{');
      if (jsonStart > 0) {
        cleanResponse = cleanResponse.substring(jsonStart);
      }

      // Remove any text after the last }
      const jsonEnd = cleanResponse.lastIndexOf('}');
      if (jsonEnd > 0) {
        cleanResponse = cleanResponse.substring(0, jsonEnd + 1);
      }

      // Parse JSON
      const parsed = JSON.parse(cleanResponse);
      return {
        success: true,
        data: parsed,
        confidence: this.calculateConfidence(parsed)
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error.message);
      console.error('Raw response:', response);
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

    // Check personal information (50% weight)
    if (data.personal) {
      if (data.personal.fullName) score += 20;
      if (data.personal.email) score += 20;
      if (data.personal.phone) score += 10;
      maxScore += 50;
    }

    // Check experience (30% weight)
    if (data.experience && Array.isArray(data.experience) && data.experience.length > 0) {
      score += Math.min(data.experience.length * 10, 30);
      maxScore += 30;
    }

    // Check education (10% weight)
    if (data.education && Array.isArray(data.education) && data.education.length > 0) {
      score += Math.min(data.education.length * 5, 10);
      maxScore += 10;
    }

    // Check skills (10% weight)
    if (data.skills && (data.skills.technical || data.skills.soft)) {
      score += 10;
      maxScore += 10;
    }
    const confidence = maxScore > 0 ? Math.round(score / maxScore * 100) / 100 : 0;
    console.log(`Confidence Score: ${confidence * 100}%`);
    return confidence;
  }

  /**
   * Get available providers
   */
  static getAvailableProviders() {
    const providers = ['gemini']; // Always available (free)

    try {
      require('groq-sdk');
      providers.push('groq');
    } catch (e) {
      // Groq not installed
    }
    try {
      require('openai');
      providers.push('openai');
    } catch (e) {
      // OpenAI not installed
    }
    try {
      require('@anthropic-ai/sdk');
      providers.push('claude');
    } catch (e) {
      // Anthropic not installed
    }
    return providers;
  }

  /**
   * Get recommended model for provider
   */
  static getRecommendedModel(provider) {
    const models = {
      'gemini': 'gemini-1.5-flash',
      'groq': 'llama3-8b-8192',
      'openai': 'gpt-3.5-turbo',
      'claude': 'claude-3-haiku-20240307'
    };
    return models[provider] || models['gemini'];
  }

  /**
   * Get token usage information from last prompt
   */
  getTokenInfo() {
    return this.lastPromptInfo || null;
  }

  /**
   * Get available parsing levels
   */
  static getParsingLevels() {
    return {
      'low': {
        description: 'Basic info only (name, email, phone)',
        tokens: '~200',
        speed: 'Fastest'
      },
      'moderate': {
        description: 'Key sections (personal, experience, education, skills)',
        tokens: '~500',
        speed: 'Fast'
      },
      'high': {
        description: 'Detailed extraction with descriptions',
        tokens: '~1000',
        speed: 'Medium'
      },
      'ultra': {
        description: 'Comprehensive extraction with full details',
        tokens: '~2000',
        speed: 'Slower'
      }
    };
  }
}
module.exports = AIProcessor;