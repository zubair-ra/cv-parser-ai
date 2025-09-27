"use strict";

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

/**
 * CV Parser Service - Standalone Implementation with Multi-Provider Support
 * Compatible with cv-parser-ai-tb npm package interface
 * Model management and fallback logic handled by the calling application
 */

class CVParserService {
  constructor(options = {}) {
    if (!options.apiKey) {
      throw new Error('AI API key is required');
    }

    this.apiKey = options.apiKey;
    this.provider = (options.provider || 'gemini').toLowerCase();
    this.model = options.model || 'gemini-1.5-flash';
    this.parsingLevel = options.parsingLevel || 'moderate';
    this.options = {
      includeMetadata: options.includeMetadata !== false,
      normalizeData: options.normalizeData !== false,
      confidenceThreshold: options.confidenceThreshold || 0.6,
      ...options
    };

    this.lastPromptInfo = null;
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
        this.client = this.genAI.getGenerativeModel({ model: this.model });
        console.log('Using Gemini Model:', this.model);
        break;
      case 'openai':
        this.model = this.model || 'gpt-3.5-turbo';
        console.log('Using OpenAI Model:', this.model);
        this.initializeOpenAI();
        break;
      case 'claude':
      case 'anthropic':
        this.model = this.model || 'claude-3-haiku-20240307';
        console.log('Using Claude Model:', this.model);
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
      const { OpenAI } = require('openai');
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
   * Parse CV from file path - Main interface method
   * Uses the specific model passed during initialization
   */
  async parse(filePath, options = {}) {
    try {
      const mergedOptions = { ...this.options, ...options };

      // Extract text from PDF
      const text = await this.extractTextFromPDF(filePath);

      // Process with AI using the configured model
      const aiResult = await this.processWithAI(text, mergedOptions);

      // Post-process results
      const finalResult = this.postProcessResults(aiResult, text, mergedOptions);

      return finalResult;
    } catch (error) {
      throw new Error(`Failed to parse CV: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF file
   */
  async extractTextFromPDF(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Process text with AI using enhanced prompt and multiple providers
   */
  async processWithAI(text, options = {}) {
    try {
      const prompt = this.buildPrompt(text);

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
   * Process with Gemini
   */
  async processWithGemini(prompt) {
    try {
      console.log('Processing with Gemini...');
      const result = await this.client.generateContent(prompt);
      const response = result.response.text();
      return this.parseAIResponse(response);
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
        messages: [
          { role: "system", content: "Extract CV data and return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
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
        temperature: 0.1,
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
        messages: [
          { role: "system", content: "Extract CV data and return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const generatedText = completion.choices[0].message.content;
      return this.parseAIResponse(generatedText);
    } catch (error) {
      throw new Error(`Groq processing failed: ${error.message}`);
    }
  }

  /**
   * Build AI prompt with enhanced summary extraction instructions
   */
  buildPrompt(text) {
    return `
You are a professional CV/Resume parser. Extract the following information from the provided CV text and return it as a valid JSON object.

REQUIRED FIELDS TO EXTRACT:
- personal: {fullName, firstName, lastName, email, phone, address, city, country, linkedIn, github, website}
- experience: [{jobTitle, company, startDate, endDate, current, location, description, achievements, technologies}]
- education: [{institution, degree, fieldOfStudy, startDate, endDate, gpa, location, achievements}]
- skills: {technical: [], soft: [], languages: [], frameworks: [], tools: [], databases: []}
- summary: Professional summary or profile description
- certifications: [{name, issuer, issueDate, expiryDate, credentialId, url}]
- projects: [{name, description, technologies, url}]

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
   * Parse AI response to JSON
   */
  parseAIResponse(response) {
    try {
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
      return {
        success: false,
        error: `Failed to parse AI response: ${error.message}`,
        rawResponse: response
      };
    }
  }

  /**
   * Calculate confidence score
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

    return maxScore > 0 ? Math.round((score / maxScore) * 100) / 100 : 0;
  }

  /**
   * Post-process AI results
   */
  postProcessResults(aiResult, originalText, options) {
    if (!aiResult.success) {
      throw new Error(aiResult.error);
    }

    let processedData = { ...aiResult.data };

    // Add metadata if enabled
    if (options.includeMetadata) {
      const confidence = aiResult.confidence;
      processedData.metadata = {
        parseDate: new Date().toISOString(),
        parseConfidence: confidence,
        provider: this.provider,
        model: this.model,
        wordCount: originalText.split(/\s+/).length,
        processingTime: Date.now(),
        ...(processedData.metadata || {})
      };
    }

    // Normalize data if enabled
    if (options.normalizeData) {
      processedData = this.normalizeData(processedData);
    }

    return processedData;
  }

  /**
   * Normalize parsed data
   */
  normalizeData(data) {
    const normalized = { ...data };

    // Normalize personal information
    if (normalized.personal) {
      if (normalized.personal.email) {
        normalized.personal.email = normalized.personal.email.toLowerCase().trim();
      }
      if (normalized.personal.phone) {
        normalized.personal.phone = normalized.personal.phone.replace(/[^\d+\-\s()]/g, '');
      }
      if (normalized.personal.fullName) {
        normalized.personal.fullName = normalized.personal.fullName.trim();
      }
    }

    // Normalize skills
    if (normalized.skills) {
      Object.keys(normalized.skills).forEach(key => {
        if (Array.isArray(normalized.skills[key])) {
          normalized.skills[key] = normalized.skills[key]
            .map(skill => skill.trim())
            .filter(skill => skill.length > 0);
        }
      });
    }

    return normalized;
  }

  /**
   * Static method for quick parsing (for compatibility)
   */
  static async quickParse(filePath, apiKey, provider = 'gemini') {
    const parser = new CVParserService({
      apiKey,
      provider,
      includeMetadata: true,
      normalizeData: true
    });
    return await parser.parse(filePath);
  }
}

// Export the class
module.exports = CVParserService;