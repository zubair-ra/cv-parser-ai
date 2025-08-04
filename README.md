# 🤖 cv-parser-ai-tb

[![npm version](https://badge.fury.io/js/cv-parser-ai-tb.svg)](https://badge.fury.io/js/cv-parser-ai-tb)

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

An AI-powered library to parse CVs and extract structured information such as name, email, skills, and more.

## ✨ Features

- 🤖 **Multi-AI Provider Support** - Supports Gemini (Free), OpenAI, and Claude for resume parsing
- 📄 **Multiple Format Support** - Easily handle resumes in PDF, DOCX, and DOC formats
- 🎯 **Flexible Schema System** - Extract only the data you need with customizable schemas
- ✅ **Data Validation & Normalization** - Built-in checks ensure clean and consistent output
- 📊 **Confidence Scoring** - Understand the reliability of parsed fields with score indicators
- 🔄 **Batch Processing** - Efficiently process multiple resumes at once
- 🛡️ **Robust Error Handling** - Automatic retries and detailed error feedback to avoid disruptions
- 🏗️ **TypeScript Support** - Fully typed for better development experience and safety
- ⚡ **High Performance** - Engineered for speed and accuracy, even at scale

## 📦 Installation

```bash
npm install cv-parser-ai-tb
```

### Prerequisites

- Node.js >= 14.0.0
- NPM >= 6.0.0
- AI Provider API Key (Gemini recommended for free usage)

## ⚡ Quick Start

```javascript
const CVParser = require('cv-parser-ai-tb');

// Initialize with free Gemini AI
const parser = new CVParser({
  apiKey: 'your-gemini-api-key', // Get free at https://aistudio.google.com/
  provider: 'gemini' // Free provider
});

// Parse a resume
const result = await parser.parse('./resume.pdf');

console.log(result.personal.fullName);  // "John Doe"
console.log(result.personal.email);     // "john@example.com"
console.log(result.experience.length);  // 3
console.log(result.skills.technical);   // ["JavaScript", "Python", "React"]
```

## 🤖 AI Providers

### Gemini (Google AI) - Recommended

```javascript
const parser = new CVParser({
  provider: 'gemini',
  apiKey: 'your-gemini-key' // FREE - Get at https://aistudio.google.com/
});
```

### OpenAI

```javascript
const parser = new CVParser({
  provider: 'openai',
  apiKey: 'your-openai-key',
  model: 'gpt-4' // Optional: gpt-3.5-turbo, gpt-4
});
```

### Claude (Anthropic)

```javascript
const parser = new CVParser({
  provider: 'claude',
  apiKey: 'your-claude-key',
  model: 'claude-3-sonnet-20240229' // Optional
});
```

## 📊 Data Structure

The parser returns a comprehensive structured object:

```javascript
{
  personal: {
    fullName: "John Doe",
    firstName: "John",
    lastName: "Doe", 
    email: "john@example.com",
    phone: "+1-555-0123",
    address: "New York, NY",
    linkedIn: "https://linkedin.com/in/johndoe",
    github: "https://github.com/johndoe"
  },
  experience: [{
    jobTitle: "Senior Software Engineer",
    company: "Tech Corp",
    startDate: "2022-01",
    endDate: "2024-03",
    duration: "2 years 2 months",
    location: "San Francisco, CA",
    description: "Led development of web applications...",
    technologies: ["React", "Node.js", "AWS"]
  }],
  education: [{
    institution: "Stanford University",
    degree: "Master of Science",
    fieldOfStudy: "Computer Science",
    startDate: "2018-09",
    endDate: "2020-06",
    gpa: "3.8"
  }],
  skills: {
    technical: ["JavaScript", "Python", "React", "AWS"],
    soft: ["Leadership", "Communication", "Problem Solving"],
    languages: ["English", "Spanish"],
    frameworks: ["React", "Express", "Django"],
    databases: ["PostgreSQL", "MongoDB"]
  },
  certifications: [{
    name: "AWS Solutions Architect",
    issuer: "Amazon Web Services",
    issueDate: "2023-01",
    credentialId: "ABC123"
  }],
  projects: [{
    name: "E-commerce Platform",
    description: "Built scalable online store",
    technologies: ["React", "Node.js", "MongoDB"],
    url: "https://github.com/johndoe/ecommerce"
  }],
  metadata: {
    parseConfidence: 0.95,
    parseDate: "2024-08-05T10:30:00Z",
    provider: "gemini",
    keywords: ["software", "engineer", "javascript"]
  }
}
```

## 💡 Usage Examples

### File Upload with Express.js

```javascript
const express = require('express');
const multer = require('multer');
const CVParser = require('cv-parser-ai-tb');

const app = express();
const upload = multer();
const parser = new CVParser({ 
  apiKey: process.env.GEMINI_API_KEY 
});

app.post('/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    const fileType = req.file.originalname.split('.').pop();
    const result = await parser.parseBuffer(req.file.buffer, fileType);
    
    // Save to database
    const candidate = await Candidate.create({
      name: result.personal.fullName,
      email: result.personal.email,
      experience: result.experience,
      skills: result.skills.technical
    });
    
    res.json({ success: true, candidate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Batch Processing

```javascript
const files = ['resume1.pdf', 'resume2.docx', 'resume3.pdf'];
const results = await parser.parseBatch(files);

console.log(`Processed: ${results.summary.successful}/${results.summary.total}`);
console.log(`Success Rate: ${results.summary.successRate}%`);

results.results.forEach(result => {
  if (result.success) {
    console.log(`✅ ${result.data.personal.fullName}`);
  } else {
    console.log(`❌ ${result.file}: ${result.error}`);
  }
});
```

### Custom Schema

```javascript
const { CVParser, CVSchema, FIELD_TYPES } = require('cv-parser-ai-tb');

// Define custom extraction schema
const customSchema = CVSchema.createCustomSchema({
  personal: {
    type: FIELD_TYPES.OBJECT,
    required: true,
    fields: {
      fullName: { type: FIELD_TYPES.NAME, required: true },
      email: { type: FIELD_TYPES.EMAIL, required: true },
      phone: { type: FIELD_TYPES.PHONE, required: false }
    }
  },
  skills: {
    type: FIELD_TYPES.OBJECT,
    required: false,
    fields: {
      technical: { type: FIELD_TYPES.SKILL_LIST, required: false }
    }
  }
});

const parser = CVParser.withSchema(customSchema, {
  apiKey: 'your-key'
});
```

### Pre-built Parsers

```javascript
// Minimal parser - only basic info
const minimalParser = CVParser.minimal({
  apiKey: 'your-key'
});

// ATS-optimized parser
const atsParser = CVParser.forATS({
  apiKey: 'your-key'
});

// Quick one-liner
const result = await CVParser.quickParse('./resume.pdf', 'your-key');
```

## ⚙️ Configuration Options

```javascript
const parser = new CVParser({
  // Required
  apiKey: 'your-api-key',
  
  // AI Provider Options
  provider: 'gemini', // 'gemini' | 'openai' | 'claude'
  model: 'gemini-1.5-flash', // Provider-specific model
  temperature: 0.1, // AI creativity (0-1)
  
  // Processing Options
  includeMetadata: true, // Include parsing metadata
  includeKeywords: true, // Extract keywords
  validateData: true, // Enable validation
  normalizeData: true, // Normalize phone, email, dates
  strictValidation: false, // Throw on validation errors
  
  // Performance Options
  retryOnFailure: true, // Retry on AI failures
  maxRetries: 2, // Number of retry attempts
  confidenceThreshold: 0.5, // Minimum confidence score
  
  // Schema
  schema: customSchema // Custom extraction schema
});
```

## 🔍 Error Handling

```javascript
const { errors } = require('cv-parser-ai-tb');

try {
  const result = await parser.parse('./resume.pdf');
} catch (error) {
  if (error instanceof errors.DocumentExtractionError) {
    console.error('Failed to extract text from document');
  } else if (error instanceof errors.AIProcessingError) {
    console.error('AI processing failed:', error.message);
  } else if (error instanceof errors.ValidationError) {
    console.error('Data validation failed:', error.field);
  } else {
    console.error('Unknown error:', error.message);
  }
}
```

## 🏗️ Integration Examples

### ATS (Applicant Tracking System)

```javascript
// Candidate screening pipeline
const screenCandidate = async (resumeBuffer) => {
  const cvData = await parser.parseBuffer(resumeBuffer, 'pdf');
  
  const score = calculateScore({
    experience: cvData.experience.length,
    skills: cvData.skills.technical,
    education: cvData.education
  });
  
  return {
    candidate: cvData.personal,
    score,
    qualified: score > 75
  };
};
```

### Job Portal

```javascript
// Auto-complete candidate profiles
app.post('/candidates/quick-signup', async (req, res) => {
  const cvData = await parser.parseBuffer(req.file.buffer, 'pdf');
  
  const profile = {
    ...cvData.personal,
    experience: cvData.experience,
    skills: cvData.skills.technical,
    profileCompletion: 85
  };
  
  res.json(profile);
});
```

### HR Analytics

```javascript
// Skills gap analysis
const analyzeSkills = async (resumes) => {
  const results = await parser.parseBatch(resumes);
  
  const allSkills = results.results
    .filter(r => r.success)
    .flatMap(r => r.data.skills.technical);
    
  const skillFrequency = countSkills(allSkills);
  return skillFrequency;
};
```

## 📈 Performance

| Metric | Value |
|--------|-------|
| **Speed** | ~2-5 seconds per resume |
| **Accuracy** | 95%+ for standard resume formats |
| **Supported Files** | PDF, DOCX, DOC |
| **Concurrent Processing** | Yes (batch processing) |
| **Rate Limits** | Depends on AI provider |

## 🛠️ Development

```bash
git clone https://github.com/zubair-ra/cv-parser-ai.git
cd cv-parser-ai
npm install
npm run build
npm test
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

