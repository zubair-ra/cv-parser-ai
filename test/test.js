// test.js
const CVParser = require('../src/index.js');
require('dotenv').config();

const GEMINI_MODELS = [
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash-8b-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-1.5-flash",
  "gemini-1.5-flash-002",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-1.5-pro",
  "gemini-1.5-pro-002",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

async function test() {
  console.log('Starting CV Parser Test...');

  const apiKey = process.env.API_KEY || "AIzaSyBMul_O1CJPwuoMp4wGyzmsr65184EF234";
  const cvPath = 'D:\\Testing C4_Resume.pdf';

  let lastError = null;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    console.log(`Trying model [${i + 1}/${GEMINI_MODELS.length}]: ${model}`);

    const parser = new CVParser({
      apiKey,
      model,
      // parsingLevel: 'ultra' // optionally pass
    });

    try {
      const result = await parser.parse(cvPath);
      console.log(`✅ Successfully parsed using model: ${model}`);
      console.log(JSON.stringify(result, null, 2));
      return;  // exit the loop early because we succeeded
    } catch (error) {
      console.error(`❌ Failed with model ${model}: ${error.message}`);
      lastError = error;
      // continue to next model
    }
  }

  console.error('All models failed to parse the CV.');
  if (lastError) {
    console.error('Last error:', lastError);
  }
}

// Kick it off
test();
