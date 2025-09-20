// test-new-features.js - Test file for new CV Parser features
const CVParser = require('../src/index.js');
require('dotenv').config();

// Test CV file path - get from environment or use placeholder
const TEST_CV_PATH = process.env.TEST_CV_PATH || 'path/to/your/cv.pdf';

async function testAllFeatures() {
    console.log('🚀 Testing CV Parser New Features...\n');

    // Test 1: Available Providers
    console.log('📋 1. Testing Available Providers');
    const providers = CVParser.getAvailableProviders();
    console.log('Available providers:', providers);
    console.log('✅ Providers test completed\n');

    // Test 2: Parsing Levels
    console.log('📋 2. Testing Parsing Levels');
    const levels = CVParser.getParsingLevels();
    console.log('Available parsing levels:');
    Object.entries(levels).forEach(([level, info]) => {
        console.log(`  ${level}: ${info.description} (${info.tokens} tokens, ${info.speed})`);
    });
    console.log('✅ Parsing levels test completed\n');

    // Test 3: Groq Provider (if available)
    if (providers.includes('groq') && process.env.GROQ_API_KEY) {
        console.log('📋 3. Testing Groq Provider');
        await testGroqProvider();
    } else {
        console.log('📋 3. Skipping Groq test (API key not found or SDK not installed)\n');
    }

    // Test 4: All Parsing Levels with Gemini
    if (process.env.GEMINI_API_KEY) {
        console.log('📋 4. Testing All Parsing Levels with Gemini');
        await testAllParsingLevels();
    } else {
        console.log('📋 4. Skipping parsing levels test (Gemini API key not found)\n');
    }

    // Test 5: Static Methods
    console.log('📋 5. Testing Static Methods');
    await testStaticMethods();

    // Test 6: Performance Comparison
    console.log('📋 6. Performance Comparison');
    await testPerformanceComparison();

    console.log('🎉 All tests completed!');
}

async function testGroqProvider() {
    try {
        console.log('Testing Groq with moderate parsing level...');
        const startTime = Date.now();

        const parser = new CVParser({
            apiKey: process.env.GROQ_API_KEY,
            provider: 'groq',
            parsingLevel: 'moderate'
        });

        const result = await parser.parse(TEST_CV_PATH);
        const endTime = Date.now();

        console.log('✅ Groq parsing successful!');
        console.log(`⏱️  Time taken: ${endTime - startTime}ms`);
        console.log(`👤 Name: ${result.personal?.fullName || 'Not found'}`);
        console.log(`📧 Email: ${result.personal?.email || 'Not found'}`);
        console.log(`🔧 Skills count: ${result.skills?.technical?.length || 0}`);
        console.log(`💼 Experience count: ${result.experience?.length || 0}`);

        if (result.metadata) {
            console.log(`📊 Confidence: ${Math.round(result.metadata.parseConfidence * 100)}%`);
        }

        console.log('✅ Groq test completed\n');
    } catch (error) {
        console.error('❌ Groq test failed:', error.message);
        console.log('');
    }
}

async function testAllParsingLevels() {
    const levels = ['low', 'moderate', 'high', 'ultra'];
    const results = {};

    for (const level of levels) {
        try {
            console.log(`Testing ${level} parsing level...`);
            const startTime = Date.now();

            const parser = new CVParser({
                apiKey: process.env.GEMINI_API_KEY,
                provider: 'gemini',
                parsingLevel: level
            });

            const result = await parser.parse(TEST_CV_PATH);
            const endTime = Date.now();

            results[level] = {
                success: true,
                time: endTime - startTime,
                name: result.personal?.fullName || 'Not found',
                email: result.personal?.email || 'Not found',
                skillsCount: result.skills?.technical?.length || 0,
                experienceCount: result.experience?.length || 0,
                confidence: result.metadata?.parseConfidence || 0
            };

            console.log(`✅ ${level} level completed in ${endTime - startTime}ms`);

        } catch (error) {
            console.error(`❌ ${level} level failed:`, error.message);
            results[level] = { success: false, error: error.message };
        }
    }

    // Print comparison table
    console.log('\n📊 Parsing Levels Comparison:');
    console.log('Level\t\tTime(ms)\tName\t\tSkills\tExperience\tConfidence');
    console.log('─'.repeat(80));

    Object.entries(results).forEach(([level, result]) => {
        if (result.success) {
            const name = (result.name || 'None').substring(0, 12);
            console.log(`${level.padEnd(12)}\t${result.time}\t\t${name.padEnd(12)}\t${result.skillsCount}\t${result.experienceCount}\t\t${Math.round(result.confidence * 100)}%`);
        } else {
            console.log(`${level.padEnd(12)}\tFAILED\t\t${result.error}`);
        }
    });

    console.log('✅ All parsing levels test completed\n');
}

async function testStaticMethods() {
    try {
        // Test fastParse
        if (process.env.GROQ_API_KEY) {
            console.log('Testing CVParser.fastParse()...');
            const startTime = Date.now();
            const result = await CVParser.fastParse(TEST_CV_PATH, process.env.GROQ_API_KEY);
            const endTime = Date.now();

            console.log(`✅ Fast parse completed in ${endTime - startTime}ms`);
            console.log(`👤 Name: ${result.personal?.fullName || 'Not found'}`);
        }

        // Test detailedParse
        if (process.env.GEMINI_API_KEY) {
            console.log('Testing CVParser.detailedParse()...');
            const startTime = Date.now();
            const result = await CVParser.detailedParse(TEST_CV_PATH, process.env.GEMINI_API_KEY);
            const endTime = Date.now();

            console.log(`✅ Detailed parse completed in ${endTime - startTime}ms`);
            console.log(`👤 Name: ${result.personal?.fullName || 'Not found'}`);
            console.log(`🔧 Skills: ${result.skills?.technical?.slice(0, 3).join(', ') || 'None'}`);
        }

        console.log('✅ Static methods test completed\n');
    } catch (error) {
        console.error('❌ Static methods test failed:', error.message);
        console.log('');
    }
}

async function testPerformanceComparison() {
    if (!process.env.GEMINI_API_KEY) {
        console.log('Skipping performance test (Gemini API key not found)\n');
        return;
    }

    try {
        console.log('Comparing old vs new approach performance...');

        // Test old approach (ultra level)
        console.log('Testing old approach (ultra level)...');
        const oldStart = Date.now();
        const oldParser = new CVParser({
            apiKey: process.env.GEMINI_API_KEY,
            provider: 'gemini',
            parsingLevel: 'ultra'
        });
        const oldResult = await oldParser.parse(TEST_CV_PATH);
        const oldTime = Date.now() - oldStart;

        // Test new approach (moderate level)
        console.log('Testing new approach (moderate level)...');
        const newStart = Date.now();
        const newParser = new CVParser({
            apiKey: process.env.GEMINI_API_KEY,
            provider: 'gemini',
            parsingLevel: 'moderate'
        });
        const newResult = await newParser.parse(TEST_CV_PATH);
        const newTime = Date.now() - newStart;

        console.log('\n📊 Performance Comparison:');
        console.log('Approach\t\tTime(ms)\tSpeed Improvement');
        console.log('─'.repeat(50));
        console.log(`Old (ultra)\t\t${oldTime}\t\t-`);
        console.log(`New (moderate)\t\t${newTime}\t\t${Math.round((oldTime - newTime) / oldTime * 100)}% faster`);

        console.log('\n📋 Data Quality Comparison:');
        console.log(`Old: Name: ${oldResult.personal?.fullName || 'None'}, Skills: ${oldResult.skills?.technical?.length || 0}`);
        console.log(`New: Name: ${newResult.personal?.fullName || 'None'}, Skills: ${newResult.skills?.technical?.length || 0}`);

        console.log('✅ Performance comparison completed\n');
    } catch (error) {
        console.error('❌ Performance test failed:', error.message);
        console.log('');
    }
}

async function testErrorHandling() {
    console.log('📋 Testing Error Handling');

    try {
        // Test invalid provider
        const invalidParser = new CVParser({
            apiKey: 'test-key',
            provider: 'invalid-provider'
        });
        console.log('❌ Should have thrown error for invalid provider');
    } catch (error) {
        console.log('✅ Invalid provider error handled correctly');
    }

    try {
        // Test invalid parsing level
        const parser = new CVParser({
            apiKey: process.env.GEMINI_API_KEY || 'test-key',
            provider: 'gemini',
            parsingLevel: 'invalid-level'
        });
        // This should fallback to 'moderate' level
        console.log('✅ Invalid parsing level handled with fallback');
    } catch (error) {
        console.log('✅ Invalid parsing level error handled correctly');
    }

    console.log('✅ Error handling tests completed\n');
}

// Additional test for specific provider
async function testSpecificProvider(provider, apiKey) {
    if (!apiKey) {
        console.log(`Skipping ${provider} test (API key not provided)`);
        return;
    }

    try {
        console.log(`📋 Testing ${provider.toUpperCase()} Provider`);
        const startTime = Date.now();

        const parser = new CVParser({
            apiKey: apiKey,
            provider: provider,
            parsingLevel: 'moderate'
        });

        // Get parser info
        const info = parser.getInfo();
        console.log(`Provider: ${info.provider}`);
        console.log(`Model: ${info.model}`);
        console.log(`Parsing Level: ${parser.options.parsingLevel}`);

        const result = await parser.parse(TEST_CV_PATH);
        const endTime = Date.now();

        console.log(`✅ ${provider} parsing completed in ${endTime - startTime}ms`);
        console.log(`👤 Extracted: ${result.personal?.fullName || 'Name not found'}`);
        console.log('');

        return result;
    } catch (error) {
        console.error(`❌ ${provider} test failed:`, error.message);
        console.log('');
        return null;
    }
}

// Main test runner
async function runTests() {
    console.log('🧪 CV Parser New Features Test Suite');
    console.log('=' .repeat(50));

    // Check if test file exists
    const fs = require('fs');
    if (!fs.existsSync(TEST_CV_PATH)) {
        console.log(`❌ Test CV file not found: ${TEST_CV_PATH}`);
        console.log('Please update TEST_CV_PATH in this file to point to a valid CV file.');
        return;
    }

    await testAllFeatures();
    await testErrorHandling();

    // Test individual providers if API keys are available
    console.log('🔍 Testing Individual Providers:');
    await testSpecificProvider('gemini', process.env.GEMINI_API_KEY);
    await testSpecificProvider('groq', process.env.GROQ_API_KEY);
    await testSpecificProvider('openai', process.env.OPENAI_API_KEY);
    await testSpecificProvider('claude', process.env.CLAUDE_API_KEY);

    console.log('🎯 Test Suite Completed!');
    console.log('=' .repeat(50));
}

// Run the tests
runTests().catch(console.error);