# Agent Testing Guide

## Quick Start

To test all 6 Content Quality & Fact-Checking agents:

```bash
cd functions
npm run test:agents
```

## What Gets Tested

The test script (`scripts/test-all-agents.ts`) programmatically verifies:

### 1. BaseAgent Infrastructure ✅
- OpenAI API key configuration
- API connectivity
- Response generation capability

### 2. Fact Check Pre-Check Agent ✅
- Text analysis for fact-checking needs
- Chirp pre-checking
- Risk score calculation
- Content type classification

### 3. Claim Extraction Agent ✅
- Claim extraction from text
- Image text extraction (if applicable)
- Claim structure validation
- Domain and risk level assignment

### 4. Fact Check Agent ✅
- Fact-checking of extracted claims
- Verdict generation (true/false/mixed/unknown)
- Evidence collection and quality scoring
- Confidence calculation

### 5. Discussion Quality Agent ✅
- Thread quality analysis (4 dimensions)
- Comment role classification
- Per-comment contribution scoring
- Summary generation

### 6. Value Scoring Agent ✅
- 5-dimensional value scoring
- Domain-specific weighting
- Fact-check penalty application
- Total score calculation

### 7. Explainer Agent ✅
- Explanation generation
- Human-readable summaries
- Value driver identification

## Test Results

Each test reports:
- ✅ **PASS**: Agent responded successfully with valid data
- ❌ **FAIL**: Agent failed to respond or returned invalid data
- ⏭️ **SKIP**: Test skipped (e.g., BaseAgent unavailable but fallback works)

## Requirements

### Environment Variables
- `OPENAI_API_KEY`: Required for AI-powered agents (optional for fallback testing)

### Dependencies
- All npm packages installed (`npm install`)
- TypeScript compiled (`npm run build`)

## Running in Different Environments

### Local Development
```bash
cd functions
npm run test:agents
```

### Firebase Cloud Functions (Deployed)
The agents are automatically tested when:
- `processChirpValue` is called
- `processCommentValue` is called
- Any agent is invoked through the pipeline

### CI/CD Pipeline
Add to your CI configuration:
```yaml
- name: Test Agents
  run: |
    cd functions
    npm install
    npm run test:agents
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Interpreting Results

### All Tests Pass ✅
- All agents are active and generating responses
- BaseAgent is properly configured
- OpenAI API is accessible

### BaseAgent Fails ❌
- Check `OPENAI_API_KEY` environment variable
- Verify API key is valid and has credits
- Check network connectivity to OpenAI

### Individual Agent Fails ❌
- Check agent-specific error messages
- Verify agent imports are correct
- Check for TypeScript compilation errors
- Review agent implementation for bugs

### Tests Pass with Fallbacks ⚠️
- BaseAgent unavailable but heuristics work
- Agents are functional but not using AI
- Consider configuring OpenAI API for full functionality

## Next Steps

After running tests:

1. **If all pass**: Agents are ready for production use
2. **If BaseAgent fails**: Configure `OPENAI_API_KEY` for AI functionality
3. **If agents fail**: Review error messages and fix implementation issues
4. **For production**: Monitor agent performance and error rates

## Related Documentation

- `AGENTS_ANALYSIS.md` - Detailed agent architecture and capabilities
- `scripts/README.md` - Script documentation
- `src/services/*Agent.ts` - Agent implementations

