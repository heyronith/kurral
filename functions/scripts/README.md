# Agent Testing Scripts

## Overview

This directory contains test scripts for verifying that all Content Quality & Fact-Checking agents are properly active and can generate responses in Firebase Cloud Functions.

## Test Script: `test-all-agents.ts`

Comprehensive test suite that verifies all 6 agents:

1. **BaseAgent** - Core infrastructure and OpenAI API access
2. **Fact Check Pre-Check Agent** - Pre-screening for fact-checking needs
3. **Claim Extraction Agent** - Extracting verifiable claims from content
4. **Fact Check Agent** - Verifying claim truthfulness
5. **Discussion Quality Agent** - Analyzing comment thread quality
6. **Value Scoring Agent** - Scoring content across 5 dimensions
7. **Explainer Agent** - Generating human-readable explanations

## Running the Tests

### Option 1: Using npm script (Recommended)

```bash
cd functions
npm run test:agents
```

### Option 2: Using the shell script

```bash
cd functions
./scripts/run-agent-tests.sh
```

### Option 3: Manual compilation and execution

```bash
cd functions
npm run build
node lib/scripts/test-all-agents.js
```

## Prerequisites

1. **Environment Variables:**
   - `OPENAI_API_KEY` must be set in your environment or `.env` file
   - The script will check if BaseAgent is available and test accordingly

2. **Dependencies:**
   - All npm dependencies must be installed (`npm install`)
   - TypeScript must be compiled (`npm run build`)

## What the Tests Verify

For each agent, the test verifies:

- ✅ **Availability**: Agent can be imported and instantiated
- ✅ **Response Generation**: Agent can generate valid responses
- ✅ **Error Handling**: Agent handles errors gracefully
- ✅ **Fallback Mechanisms**: Agent uses heuristics when AI unavailable
- ✅ **Data Structure**: Responses match expected TypeScript types

## Test Output

The script provides:

- **Per-Agent Status**: Pass/Fail for each agent
- **Response Details**: Sample outputs from each agent
- **Performance Metrics**: Duration for each test
- **Summary**: Overall pass/fail count and total duration
- **BaseAgent Status**: Whether OpenAI API is configured

## Example Output

```
🧪 Testing All Content Quality & Fact-Checking Agents

======================================================================

1️⃣  Testing BaseAgent...
   ✅ BaseAgent: Agent responded successfully (1234ms)

2️⃣  Testing Fact Check Pre-Check Agent...
   ✅ Fact Check Pre-Check Agent: Agent responded successfully (567ms)
   Needs Fact-Check: true
   Confidence: 0.85

3️⃣  Testing Claim Extraction Agent...
   ✅ Claim Extraction Agent: Agent responded successfully (2345ms)
   Claims Extracted: 2
   Sample Claim: "COVID-19 vaccine reduces transmission by 85%..."

...

======================================================================
📊 TEST SUMMARY
======================================================================
Total Tests: 7
✅ Passed: 7
❌ Failed: 0
Total Duration: 12345ms
Average Duration: 1764ms

🎉 All agent tests passed!
```

## Troubleshooting

### BaseAgent Not Available

If BaseAgent fails:
- Check that `OPENAI_API_KEY` is set in your environment
- Verify the API key is valid and has credits
- Agents will still test with fallback heuristics

### Import Errors

If you see import errors:
- Ensure TypeScript is compiled: `npm run build`
- Check that all dependencies are installed: `npm install`
- Verify you're running from the `functions` directory

### Timeout Errors

If tests timeout:
- Check your internet connection
- Verify OpenAI API is accessible
- Consider increasing timeout in test script

## Integration with CI/CD

You can integrate this test into your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Test Agents
  run: |
    cd functions
    npm install
    npm run test:agents
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Related Files

- `test-precheck-agent.js` - Legacy test for pre-check agent only
- `../src/services/*Agent.ts` - Agent implementations
- `../src/agents/baseAgent.ts` - BaseAgent infrastructure

