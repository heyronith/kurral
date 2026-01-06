const fs = require('node:fs');
const path = require('node:path');

const loadEnvFile = (envPath) => {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

const run = async () => {
  loadEnvFile(path.join(__dirname, '..', '.env'));

  const { preCheckText } = require('../lib/services/factCheckPreCheckAgent');

  const cases = [
    {
      name: 'Factual stat',
      text: 'The unemployment rate fell to 3.4% in 2023 according to the Bureau of Labor Statistics.',
      expect: true,
    },
    {
      name: 'Health claim',
      text: 'Studies show this supplement reduces blood pressure by 15% within two weeks.',
      expect: true,
    },
    {
      name: 'Opinion',
      text: 'I think this movie is the best of the year.',
      expect: false,
    },
  ];

  let failed = 0;
  for (const testCase of cases) {
    const result = await preCheckText(testCase.text);
    const pass = result.needsFactCheck === testCase.expect;
    if (!pass) failed += 1;
    console.log(
      `${pass ? 'PASS' : 'FAIL'} - ${testCase.name}: needsFactCheck=${result.needsFactCheck} confidence=${result.confidence.toFixed(
        2
      )} type=${result.contentType} reason=${result.reasoning}`
    );
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('Pre-check test failed:', error);
  process.exitCode = 1;
});
