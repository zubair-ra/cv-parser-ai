// test-quality-maintained.js - Test token usage across all parsing levels
const CVParser = require('../src/index.js');
require('dotenv').config();

async function testAllLevels() {
    console.log('🎯 Gemini Token Usage Test - All Parsing Levels\n');

    const cvPath = 'D:\\Mahnoor Asif_Resume.pdf';
    const apiKey = "AIzaSyAnIEjtdPHlNwKwXWn_GDZLvf-LyXGz1h8";

    const levels = [
        { name: 'Original', level: null },
        { name: 'Ultra', level: 'ultra' },
        { name: 'High', level: 'high' },
        { name: 'Moderate', level: 'moderate' },
        { name: 'Low', level: 'low' }
    ];

    const results = [];

    console.log('📋 PARSING LEVELS TO TEST:');
    console.log('─'.repeat(60));
    levels.forEach((l, idx) => {
        const desc = idx === 0 ? 'Full CV text processing' :
                     l.level === 'ultra' ? 'Maximum compression' :
                     l.level === 'high' ? 'High compression' :
                     l.level === 'moderate' ? 'Balanced compression' :
                     'Light compression';
        console.log(`  ${idx + 1}. ${l.name.padEnd(10)} - ${desc}`);
    });
    console.log('─'.repeat(60) + '\n');

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

            // Calculate actual tokens based on prompt info
            const tokens = tokenInfo?.estimatedTokens || 0;
            const originalLength = tokenInfo?.originalTextLength || tokenInfo?.textLength || 0;
            const compressedLength = tokenInfo?.compressedTextLength || originalLength;
            const compressionRatio = tokenInfo?.compressionRatio || (originalLength > 0 ? Math.round((1 - compressedLength / originalLength) * 100) : 0);

            const summary = {
                level: levelConfig.name,
                name: result.personal?.fullName || 'Not found',
                email: result.personal?.email || 'Not found',
                phone: result.personal?.phone || 'Not found',
                experience: result.experience?.length || 0,
                skills: result.skills?.technical?.length || 0,
                confidence: Math.round((result.metadata?.parseConfidence || 0) * 100),
                tokens: tokens,
                textLength: compressedLength,
                compression: compressionRatio,
                time: endTime - startTime
            };

            results.push(summary);

            console.log(`   ✅ ${levelConfig.name}: ${summary.tokens} tokens`);
            console.log(`      📊 Token Count: ${summary.tokens}`);
            console.log(`      📉 Compression: ${summary.compression}%`);
            console.log(`      📝 Text Length: ${summary.textLength} chars (from ${originalLength})`);
            console.log(`      ⏱️  Time: ${summary.time}ms`);

            // Debug info
            if (tokenInfo) {
                console.log(`      🔍 Debug: Level=${tokenInfo.level}, PromptLen=${tokenInfo.promptLength}`);
            }
            console.log();
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

        console.log('\n📈 TOKEN REDUCTION ANALYSIS:');
        console.log('═'.repeat(80));
        console.log('Level       | Tokens | Reduction | Compression | Reason');
        console.log('─'.repeat(80));

        const baseTokens = results[0].tokens;
        results.forEach((r, idx) => {
            const reduction = idx === 0 ? '0%' :
                `${Math.round(((baseTokens - r.tokens) / baseTokens) * 100)}%`;

            let reason = '';
            if (idx === 0) {
                reason = 'Full CV text with all details';
            } else if (r.level === 'Ultra') {
                reason = 'Maximum compression - key points only';
            } else if (r.level === 'High') {
                reason = 'High compression - essential info retained';
            } else if (r.level === 'Moderate') {
                reason = 'Balanced - important sections preserved';
            } else if (r.level === 'Low') {
                reason = 'Light compression - most content kept';
            }

            console.log(`${r.level.padEnd(11)} | ${r.tokens.toString().padStart(6)} | ${reduction.padStart(9)} | ${(r.compression + '%').padStart(11)} | ${reason}`);
        });
        console.log('═'.repeat(80));

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