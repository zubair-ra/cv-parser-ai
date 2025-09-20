// test-quality-maintained.js - Test token usage across all parsing levels
const CVParser = require('../src/index.js');
require('dotenv').config();

async function testAllLevels() {
    console.log('🎯 Gemini Token Usage Test - All Parsing Levels\n');

    const cvPath = process.env.TEST_CV_PATH || 'path/to/your/cv.pdf';
    const apiKey = process.env.GEMINI_API_KEY;

    const levels = [
        { name: 'Original', level: null },
        { name: 'Ultra', level: 'ultra' },
        { name: 'High', level: 'high' },
        { name: 'Moderate', level: 'moderate' },
        { name: 'Low', level: 'low' }
    ];

    const results = [];

    if (!apiKey) {
        console.error('❌ No GEMINI_API_KEY found in .env file');
        console.log('💡 Please add your API key to .env file');
        return;
    }

    try {
        for (const levelConfig of levels) {
            console.log(`🔍 Testing ${levelConfig.name} Level...`);

            const parser = new CVParser({
                apiKey: apiKey,
                model: "gemini-1.5-flash",
                parsingLevel: levelConfig.level
            });

            const startTime = Date.now();
            const result = await parser.parse(cvPath);
            const endTime = Date.now();

            const tokenInfo = parser.aiProcessor.getTokenInfo();

            const summary = {
                level: levelConfig.name,
                name: result.personal?.fullName || 'Not found',
                email: result.personal?.email || 'Not found',
                phone: result.personal?.phone || 'Not found',
                experience: result.experience?.length || 0,
                skills: result.skills?.technical?.length || 0,
                confidence: Math.round((result.metadata?.parseConfidence || 0) * 100),
                tokens: tokenInfo?.estimatedTokens || 0,
                textLength: tokenInfo?.compressedTextLength || tokenInfo?.textLength || 0,
                compression: tokenInfo?.compressionRatio || 0,
                time: endTime - startTime
            };

            results.push(summary);

            console.log(`   ✅ ${levelConfig.name}: ${summary.tokens} tokens, ${summary.confidence}% confidence\n`);
        }

        // Print comprehensive comparison table
        console.log('📊 COMPREHENSIVE RESULTS COMPARISON:');
        console.log('=' .repeat(120));
        console.log('Level\t\tTokens\t\tName\t\t\tEmail\t\t\tExp\tSkills\tConf%\tTime(ms)\tCompression%');
        console.log('─'.repeat(120));

        results.forEach(r => {
            const nameShort = (r.name || 'None').substring(0, 15).padEnd(15);
            const emailShort = (r.email || 'None').substring(0, 20).padEnd(20);

            console.log(
                `${r.level.padEnd(12)}\t${r.tokens}\t\t${nameShort}\t${emailShort}\t${r.experience}\t${r.skills}\t${r.confidence}%\t${r.time}\t\t${r.compression}%`
            );
        });

        console.log('\n💰 COST ANALYSIS (15,000 CVs/month):');
        console.log('─'.repeat(60));

        const originalTokens = results[0].tokens;
        results.forEach(r => {
            const savings = originalTokens - r.tokens;
            const savingsPercent = Math.round((savings / originalTokens) * 100);
            const monthlyCost = (r.tokens * 15000 * 0.0005) / 1000;
            const originalCost = (originalTokens * 15000 * 0.0005) / 1000;
            const moneySaved = originalCost - monthlyCost;

            console.log(`${r.level.padEnd(12)}: ${r.tokens} tokens (-${savingsPercent}%), $${monthlyCost.toFixed(2)}/month (save $${moneySaved.toFixed(2)})`);
        });

        console.log('\n🎯 QUALITY SUMMARY:');
        console.log('─'.repeat(40));
        results.forEach(r => {
            const qualityIcon = r.confidence >= 80 ? '🟢' : r.confidence >= 60 ? '🟡' : '🔴';
            console.log(`${qualityIcon} ${r.level}: ${r.confidence}% confidence, ${r.tokens} tokens`);
        });

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run test
testAllLevels().catch(console.error);