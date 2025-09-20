// test-simple.js - Simple test for new parsing levels
const CVParser = require('../src/index.js');
require('dotenv').config();

async function quickTest() {
    console.log('🚀 Quick Test of New Features\n');

    // Get configuration from environment variables
    const cvPath = process.env.TEST_CV_PATH || 'D:\\resume.pdf';
    const apiKey = process.env.GEMINI_API_KEY;
    const defaultProvider = process.env.DEFAULT_PROVIDER || 'gemini';
    const defaultLevel = process.env.DEFAULT_PARSING_LEVEL || 'moderate';

    // Check if API key is available
    if (!apiKey) {
        console.error('❌ No GEMINI_API_KEY found in .env file');
        console.log('💡 Please add your API key to .env file:');
        console.log('   GEMINI_API_KEY=your_api_key_here');
        return;
    }

    console.log(`📁 Testing CV: ${cvPath}`);
    console.log(`🔑 Using provider: ${defaultProvider}`);
    console.log(`📊 Default level: ${defaultLevel}\n`);

    try {
        // Test 1: Low-level parsing (fastest, cheapest)
        console.log('1️⃣ Testing LOW parsing level (basic info only)...');
        const fastResult = await CVParser.fastParse(cvPath, apiKey, defaultProvider);


        console.log('📋 Fast Parse Results:-->',fastResult);
        console.log(`   Name: ${fastResult.personal?.fullName || 'Not found'}`);
        console.log(`   Email: ${fastResult.personal?.email || 'Not found'}`);
        console.log(`   Phone: ${fastResult.personal?.phone || 'Not found'}`);
        console.log(`   Skills: ${fastResult.skills?.technical?.length || 0} found\n`);

        // Test 2: Moderate parsing (balanced)
        console.log('2️⃣ Testing MODERATE parsing level...');
        const moderateParser = new CVParser({
            apiKey: apiKey,
            provider: defaultProvider,
            parsingLevel: defaultLevel
        });

        const moderateResult = await moderateParser.parse(cvPath);

        console.log('📋 Moderate Parse Results:',fastResult);
        console.log(`   Name: ${moderateResult.personal?.fullName || 'Not found'}`);
        console.log(`   Email: ${moderateResult.personal?.email || 'Not found'}`);
        console.log(`   Experience: ${moderateResult.experience?.length || 0} jobs`);
        console.log(`   Education: ${moderateResult.education?.length || 0} entries`);
        console.log(`   Skills: ${moderateResult.skills?.technical?.length || 0} technical skills\n`);

        // Test 3: High-level parsing (detailed)
        console.log('3️⃣ Testing HIGH parsing level (detailed)...');
        const detailedResult = await CVParser.detailedParse(cvPath, apiKey, defaultProvider);

        console.log('📋 Detailed Parse Results:',fastResult);
        console.log(`   Name: ${detailedResult.personal?.fullName || 'Not found'}`);
        console.log(`   Skills: ${detailedResult.skills?.technical?.slice(0, 5).join(', ') || 'None'}`);
        console.log(`   Latest Job: ${detailedResult.experience?.[0]?.jobTitle || 'Not found'}`);
        console.log(`   Company: ${detailedResult.experience?.[0]?.company || 'Not found'}\n`);

        // Show available options
        console.log('📊 Available Options:');
        console.log('Providers:', CVParser.getAvailableProviders().join(', '));
        console.log('Parsing Levels:');
        const levels = CVParser.getParsingLevels();
        Object.entries(levels).forEach(([level, info]) => {
            console.log(`   ${level}: ${info.description} (${info.tokens} tokens)`);
        });

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Tips:');
        console.log('1. Make sure you have a valid Gemini API key in .env file');
        console.log('2. Update the cvPath variable to point to your test CV file');
        console.log('3. Ensure the CV file exists and is readable');
    }
}

// Test different providers if available
async function testProviders() {
    console.log('\n🔍 Testing Different Providers:\n');

    const providers = [
        { name: 'groq', key: process.env.GROQ_API_KEY },
        { name: 'gemini', key: process.env.GEMINI_API_KEY },
        { name: 'openai', key: process.env.OPENAI_API_KEY },
        { name: 'claude', key: process.env.CLAUDE_API_KEY }
    ];

    for (const provider of providers) {
        if (provider.key) {
            try {
                console.log(`Testing ${provider.name.toUpperCase()}...`);
                const startTime = Date.now();

                const parser = new CVParser({
                    apiKey: provider.key,
                    provider: provider.name,
                    parsingLevel: 'low' // Fast test
                });

                const result = await parser.parse(process.env.TEST_CV_PATH || 'D:\\resume.pdf');
                const endTime = Date.now();

                console.log(`✅ ${provider.name}: ${endTime - startTime}ms - Name: ${result.personal?.fullName || 'Not found'}`);
            } catch (error) {
                console.log(`❌ ${provider.name}: ${error.message}`);
            }
        } else {
            console.log(`⏭️  ${provider.name.toUpperCase()}: No API key provided`);
        }
    }
}

// Run tests
async function main() {
    await quickTest();
    await testProviders();
}

main().catch(console.error);