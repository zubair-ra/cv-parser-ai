# CV Parser Testing Guide

## New Features Test Files

### 📁 Test Files Overview

1. **`test-new-features.js`** - Comprehensive test suite for all new features
2. **`test-simple.js`** - Quick and simple test for basic functionality
3. **`test.js`** - Original test file (existing)

## 🚀 Quick Start Testing

### 1. Update Test Configuration

First, update the CV file path in the test files:

```javascript
// In test-new-features.js and test-simple.js
const TEST_CV_PATH = 'D:\\Your_CV_File.pdf'; // Update this path
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```env
# Required for basic testing
GEMINI_API_KEY=your_gemini_api_key_here

# Optional - for testing other providers
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
```

### 3. Install Dependencies

```bash
# Install required packages
npm install

# Install optional providers (for full testing)
npm install groq-sdk openai @anthropic-ai/sdk
```

## 🧪 Running Tests

### Simple Test (Recommended)
```bash
node test/test-simple.js
```

**Tests:**
- ✅ Low parsing level (fastest)
- ✅ Moderate parsing level (balanced)
- ✅ High parsing level (detailed)
- ✅ Multiple providers comparison

### Comprehensive Test Suite
```bash
node test/test-new-features.js
```

**Tests:**
- ✅ All available providers
- ✅ All parsing levels comparison
- ✅ Static methods (fastParse, detailedParse)
- ✅ Performance benchmarking
- ✅ Error handling
- ✅ Provider-specific testing

### Original Test
```bash
node test/test.js
```

## 📊 New Features Being Tested

### 1. Groq Provider Integration
```javascript
const parser = new CVParser({
  apiKey: 'your-groq-key',
  provider: 'groq', // New ultra-fast provider
  parsingLevel: 'moderate'
});
```

### 2. Parsing Levels
```javascript
// Four levels available:
parsingLevel: 'low'      // ~200 tokens, basic info only
parsingLevel: 'moderate' // ~500 tokens, key sections
parsingLevel: 'high'     // ~1000 tokens, detailed
parsingLevel: 'ultra'    // ~2000 tokens, comprehensive
```

### 3. Static Helper Methods
```javascript
// Fast parsing with Groq
await CVParser.fastParse(filePath, apiKey);

// Detailed parsing with Gemini
await CVParser.detailedParse(filePath, apiKey);

// Get available options
CVParser.getAvailableProviders();
CVParser.getParsingLevels();
```

## 📋 Expected Test Results

### Performance Improvements:
- **Speed**: 2-3x faster with low/moderate levels
- **Cost**: 60-80% reduction in tokens/cost
- **Accuracy**: Maintained quality with optimized prompts

### Provider Comparison:
| Provider | Speed | Cost (500 CVs/day) | Best For |
|----------|-------|------------------|----------|
| Groq | 1-2s | $1.50/month | Speed + Cost |
| Gemini | 2-3s | $6.00/month | Balance |
| Claude | 2-4s | $3.00/month | Accuracy |
| OpenAI | 3-6s | $18.00/month | Features |

### Parsing Level Comparison:
| Level | Tokens | Speed | Use Case |
|-------|--------|-------|----------|
| Low | ~200 | Fastest | Basic contact info |
| Moderate | ~500 | Fast | CRM integration |
| High | ~1000 | Medium | Detailed analysis |
| Ultra | ~2000 | Slower | Full extraction |

## 🐛 Troubleshooting

### Common Issues:

1. **API Key Errors**
   - Ensure `.env` file exists with valid API keys
   - Check API key format and permissions

2. **File Not Found**
   - Update `TEST_CV_PATH` to point to existing CV file
   - Ensure file is readable PDF or DOCX

3. **Provider Not Available**
   - Install required SDK: `npm install groq-sdk`
   - Check if provider is in available list

4. **Parsing Failures**
   - Try different parsing levels
   - Check CV file format and content
   - Verify API rate limits

### Debug Mode:
```javascript
// Enable detailed logging
const parser = new CVParser({
  apiKey: 'your-key',
  provider: 'gemini',
  parsingLevel: 'moderate',
  includeMetadata: true // Shows confidence scores
});
```

## 📈 Performance Monitoring

The test files include performance monitoring:

```javascript
// Timing example from tests
const startTime = Date.now();
const result = await parser.parse(cvPath);
const endTime = Date.now();
console.log(`Parsing took: ${endTime - startTime}ms`);
```

## 🎯 Success Criteria

Tests pass if:
- ✅ Basic info extracted (name, email, phone)
- ✅ Parsing completes under 10 seconds
- ✅ No critical errors thrown
- ✅ Confidence score > 0.5 (when metadata enabled)
- ✅ Cost reduction achieved with parsing levels

## 📞 Support

If tests fail:
1. Check the troubleshooting section
2. Verify your CV file format
3. Test with the simple test first
4. Check API key validity and quotas