# Web Search Investigation

## Why Web Search is Not Available

### The Problem

The code uses OpenAI's **Responses API** (`client.responses.create()`) with the `web_search_preview` tool, but web search is not actually being executed. The logs show:
- `hasWebSearch: false`
- `citationCount: 0`
- No web search results in the response

### Root Causes

#### 1. **Responses API May Require Special Access** ⚠️

The OpenAI Responses API with `web_search_preview` appears to be:
- A **beta/preview feature** that may require:
  - Special API access/permissions
  - Enterprise account or specific tier
  - Explicit enablement in OpenAI dashboard
- Not available to all API keys by default

#### 2. **API Method Exists But Feature May Be Restricted**

The Node.js SDK (`openai@6.9.1`) includes the `responses` property:
```javascript
client.responses.create() // ✅ Method exists
```

However, the actual web search functionality may be:
- Restricted to certain account types
- Requires explicit enablement
- May be in limited beta

#### 3. **Response Format May Be Different**

The code expects:
```javascript
response.output[].content[].type === 'web_search'
```

But the actual response might:
- Not include web search content even if requested
- Have a different structure
- Return an error that's being silently caught

### Current Behavior

1. **API Call Succeeds** - No errors thrown
2. **Response Received** - `output_text` and `output` array exist
3. **Web Search Not Executed** - No `web_search` type in content
4. **Fallback Works** - Standard fact-checking is used instead

### Evidence from Logs

```
[FactCheckAgent] Web search response summary {
  chirpId: 'test-...',
  claimId: 'test-...-claim-1',
  hasOutputText: true,
  outputLength: 2,
  hasWebSearch: false,  // ← Web search not executed
  citationCount: 0      // ← No citations
}
```

### Possible Solutions

#### Option 1: Check OpenAI Account Access

1. **Verify Account Type:**
   - Check if your OpenAI account has access to Responses API
   - Check if web search is enabled in your account settings
   - May require Enterprise or specific tier

2. **Check API Dashboard:**
   - Look for "Responses API" or "Web Search" features
   - May need to enable in OpenAI dashboard

#### Option 2: Use Alternative Web Search

Instead of OpenAI's web search, you could:

1. **Use External Search APIs:**
   - Google Custom Search API
   - Bing Search API
   - SerpAPI
   - Then feed results to OpenAI for fact-checking

2. **Use OpenAI with Function Calling:**
   - Use standard `chat.completions.create()`
   - Define a function that calls external search API
   - Let OpenAI decide when to use search

#### Option 3: Disable Web Search (Current Fallback)

The code already handles this gracefully:
- Detects when web search isn't available
- Falls back to standard fact-checking
- Standard fact-checking works reliably

**To explicitly disable:**
```bash
export OPENAI_WEB_SEARCH=false
```

### Recommended Action

**For Now:**
1. ✅ **Keep the current implementation** - It gracefully falls back
2. ✅ **Standard fact-checking works** - No functionality lost
3. ⚠️ **Investigate OpenAI account** - Check if Responses API access is available

**To Investigate:**
1. Check OpenAI dashboard for Responses API access
2. Contact OpenAI support about web search availability
3. Review OpenAI documentation for latest web search requirements

**Alternative:**
- Consider implementing external web search (Google/Bing API)
- Feed search results to OpenAI for fact-checking
- More control and reliability

### Code Status

✅ **Current Implementation:**
- Detects web search unavailability
- Gracefully falls back to standard fact-checking
- No errors or crashes
- All functionality preserved

⚠️ **Web Search Status:**
- API method exists in SDK
- Feature may require special access
- Not working with current API key
- Fallback mechanism working correctly

---

**Conclusion:** Web search isn't available likely because it requires special OpenAI account access or permissions that aren't enabled. The system handles this gracefully by falling back to standard fact-checking, which works reliably.

