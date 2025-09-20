// test-backward-compatibility.js - Test backward compatibility
const CVParser = require('../src/index.js');
require('dotenv').config();

async function testBackwardCompatibility() {
    console.log('🔄 Testing Backward Compatibility\n');

    const cvPath = process.env.TEST_CV_PATH || 'path/to/your/cv.pdf';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ No GEMINI_API_KEY found');
        return;
    }

    try {
        console.log('📋 Testing ORIGINAL behavior (like before updates)...');

        // This should work exactly like the original version
        const originalParser = new CVParser({
            apiKey: apiKey,
            provider: 'gemini',
            // NO parsingLevel specified - should use original prompts
        });

        console.log('🔍 Parser info:', originalParser.getInfo());

        const startTime = Date.now();
        const result = await originalParser.parse(cvPath);
        const endTime = Date.now();

        console.log(`✅ Original parsing completed in ${endTime - startTime}ms\n`);

        console.log('📋 Results Summary:');
        console.log(`   Name: ${result.personal?.fullName || 'Not found'}`);
        console.log(`   Email: ${result.personal?.email || 'Not found'}`);
        console.log(`   Phone: ${result.personal?.phone || 'Not found'}`);
        console.log(`   Experience: ${result.experience?.length || 0} jobs`);
        console.log(`   Education: ${result.education?.length || 0} entries`);
        console.log(`   Skills: ${result.skills?.technical?.length || 0} technical skills`);

        if (result.metadata) {
            console.log(`   Confidence: ${Math.round(result.metadata.parseConfidence * 100)}%`);
        }

        // Test that it extracts actual data
        const hasData = result.personal?.fullName || result.personal?.email ||
                       (result.experience && result.experience.length > 0) ||
                       (result.skills?.technical && result.skills.technical.length > 0);

        if (hasData) {
            console.log('\n✅ SUCCESS: Original behavior working correctly!');
        } else {
            console.log('\n❌ ISSUE: Original behavior not extracting data properly');
        }

        console.log('\n📊 Full result structure check:');
        console.log(`   Has personal data: ${!!result.personal}`);
        console.log(`   Has experience data: ${!!result.experience}`);
        console.log(`   Has education data: ${!!result.education}`);
        console.log(`   Has skills data: ${!!result.skills}`);

    } catch (error) {
        console.error('❌ Backward compatibility test failed:', error.message);
    }
}

async function testNewFeatures() {
    console.log('\n🆕 Testing NEW features (opt-in only)...');

    const cvPath = process.env.TEST_CV_PATH || 'path/to/your/cv.pdf';
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        // Test explicit parsing level
        console.log('📋 Testing with explicit HIGH parsing level...');

        const newParser = new CVParser({
            apiKey: apiKey,
            provider: 'gemini',
            parsingLevel: 'high' // Explicitly set parsing level
        });

        const startTime = Date.now();
        const result = await newParser.parse(cvPath);
        const endTime = Date.now();

        console.log(`✅ New parsing completed in ${endTime - startTime}ms`);
        console.log(`   Name: ${result.personal?.fullName || 'Not found'}`);
        console.log(`   Email: ${result.personal?.email || 'Not found'}`);

    } catch (error) {
        console.error('❌ New features test failed:', error.message);
    }
}

// Run tests
async function main() {
    await testBackwardCompatibility();
    await testNewFeatures();

    console.log('\n🎯 Test Summary:');
    console.log('- Original behavior should work without any changes');
    console.log('- New parsing levels are opt-in only');
    console.log('- Existing users should see no difference');
}

main().catch(console.error);