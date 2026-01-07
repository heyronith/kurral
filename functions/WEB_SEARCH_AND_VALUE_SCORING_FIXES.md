# Web Search & Value Scoring Fixes

## Issues Identified

### 1. Value Scoring Agent - Response Format Mismatch ✅ FIXED

**Problem:**
The AI was returning scores in a flat format:
```json
{
  "epistemic": 0.85,
  "insight": 0.3,
  "practical": 0.4,
  "relational": 0.7,
  "effort": 0.5
}
```

But the code expected a nested format:
```json
{
  "scores": {
    "epistemic": 0.85,
    "insight": 0.3,
    ...
  },
  "confidence": 0.8
}
```

**Solution:**
- Updated `valueScoringAgent.ts` to handle both response formats
- Checks for `response.scores` first (expected format)
- Falls back to flat format if scores are at top level
- Added warning log when flat format is detected

**Status:** ✅ Fixed - Agent now handles both formats gracefully

---

### 2. Web Search Not Working ⚠️ PARTIALLY FIXED

**Problem:**
Web search was enabled (`ENABLE_WEB_SEARCH = true` by default) but:
- `hasWebSearch: false` in logs
- `citationCount: 0`
- No actual web search results in responses

**Root Cause:**
The code uses OpenAI's **Responses API** (`client.responses.create()`) with `web_search_preview` tool. This API:
- May not be available in all OpenAI accounts
- May require special access/permissions
- May have different response format than expected

**Solution:**
- Added detection for when web search is requested but not used
- Automatic fallback to standard fact-checking when web search fails
- Better error logging to identify web search issues
- Graceful degradation: if web search fails, uses standard BaseAgent fact-checking

**Status:** ⚠️ Partially Fixed - Code now handles failures gracefully, but web search feature may not be available

---

## How to Verify Web Search

### Check if Web Search is Available

1. **Check Environment Variable:**
   ```bash
   echo $OPENAI_WEB_SEARCH
   # Should be undefined (enabled by default) or "true"
   # Set to "false" to disable
   ```

2. **Check Logs:**
   Look for these log messages:
   - `[FactCheckAgent] Web search was requested but not used` - Web search not available
   - `[FactCheckAgent] Web search not available, using standard fact-checking` - Fallback triggered
   - `hasWebSearch: true` - Web search working

3. **Test Response:**
   - If `hasWebSearch: false` → Web search not working, using standard fact-checking
   - If `hasWebSearch: true` → Web search is working

### Enable/Disable Web Search

**To Disable (use standard fact-checking):**
```bash
export OPENAI_WEB_SEARCH=false
```

**To Enable (default):**
```bash
export OPENAI_WEB_SEARCH=true
# or unset the variable
unset OPENAI_WEB_SEARCH
```

---

## Current Behavior

### Value Scoring Agent
- ✅ **Working** - Handles both flat and nested response formats
- ✅ **Robust** - Won't crash on unexpected formats
- ✅ **Logging** - Warns when unexpected format is detected

### Fact Check Agent
- ✅ **Graceful Fallback** - Falls back to standard fact-checking if web search fails
- ⚠️ **Web Search Status** - May not be available (depends on OpenAI account)
- ✅ **Standard Fact-Checking** - Always works as fallback
- ✅ **Better Logging** - Clear messages about web search status

---

## Recommendations

### For Production

1. **Web Search:**
   - If web search is not available, the system automatically uses standard fact-checking
   - Standard fact-checking is reliable and works well
   - Consider disabling web search if it's consistently failing:
     ```bash
     export OPENAI_WEB_SEARCH=false
     ```

2. **Value Scoring:**
   - The fix handles both formats, so it should work reliably
   - Monitor logs for warnings about flat format responses
   - Consider updating prompts to explicitly request nested format

### For Testing

Run the test suite to verify:
```bash
cd functions
npm run test:agents
```

Expected results:
- ✅ Value Scoring Agent should now pass
- ✅ Fact Check Agent should work (with or without web search)
- ✅ All other agents should continue working

---

## Technical Details

### Value Scoring Fix
**File:** `src/services/valueScoringAgent.ts`
**Change:** Added format detection and handling for both response structures

### Web Search Fix
**File:** `src/services/factCheckAgent.ts`
**Change:** Added fallback logic and better error handling

---

**Last Updated:** After fixing both issues
**Status:** Ready for testing

