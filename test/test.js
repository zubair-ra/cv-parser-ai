// test.js
const CVParser = require('../src/index.js');
require('dotenv').config();

async function test() {
    console.log('Starting CV Parser Test...');
    
        const parser = new CVParser({
            apiKey: process.env.GEMINI_API_KEY, // Ensure you have set this in your .env file
            model: "gemini-1.5-flash" // Use the correct model name
        });

    try {
        const result = await parser.parse('D:\\resume.pdf');
      
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

test();