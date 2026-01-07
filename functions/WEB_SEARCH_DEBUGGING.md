# Web Search Debugging - Why It Stopped Working

## Changes Made to Debug Web Search

Since web search **used to work** but stopped, I've added comprehensive debugging and fallback mechanisms:

### 1. **Enhanced Logging** ✅

Added detailed logging to see exactly what the API is returning:

```typescript
// Logs full response structure
- hasOutput, outputType, outputLength
- outputText presence and length
- First output block structure
- Content types found in response
```

This will help identify:
- If the API is returning data but in a different format
- If the response structure changed
- What content types are actually present

### 2. **Multiple Tool Type Support** ✅

The code now tries both tool types:
- `'web_search'` (what the web app version uses)
- `'web_search_preview'` (what functions version was using)

**Why this matters:**
- OpenAI may have deprecated one tool type
- The web app version uses `'web_search'` and might still work
- Functions version was using `'web_search_preview'` which may have stopped working

### 3. **Better Response Detection** ✅

Now checks for web search in multiple ways:
- `content.type === 'web_search'`
- `content.type === 'web_search_preview'`
- `content.type === 'citation'` (indicates web search was used)
- URLs in text content (fallback detection)

### 4. **Full Response Logging** ✅

If web search isn't detected, the code now logs the full response structure (first 1000 chars) to help diagnose what changed.

## Possible Reasons It Stopped Working

### 1. **Tool Type Changed** ⚠️ Most Likely

**Hypothesis:** OpenAI deprecated `'web_search_preview'` in favor of `'web_search'`

**Evidence:**
- Web app version uses `'web_search'` (line 350 in webapp version)
- Functions version uses `'web_search_preview'` (line 294 in functions version)
- TypeScript types show both are valid, but behavior may differ

**Fix:** Code now tries both types

### 2. **Response Structure Changed** ⚠️ Possible

**Hypothesis:** OpenAI changed the response format

**Evidence:**
- API call succeeds (no errors)
- Response is returned
- But web search content not detected in expected location

**Fix:** Enhanced logging will show actual response structure

### 3. **API Behavior Changed** ⚠️ Possible

**Hypothesis:** OpenAI changed when web search is actually executed

**Evidence:**
- `tool_choice: { type: 'web_search_preview' }` forces tool use
- But tool may not be executing even when forced

**Fix:** Code now tries without forcing tool choice as fallback

### 4. **Account/API Key Changes** ⚠️ Less Likely

**Hypothesis:** API key lost access or account tier changed

**Evidence:**
- If this was the case, API call would likely fail
- But API call succeeds, just no web search

## Next Steps to Diagnose

### Run the Test Again

```bash
cd functions
npm run test:agents
```

**Look for these new log messages:**

1. **Tool type attempts:**
   ```
   [FactCheckAgent] Attempting web search with tool type: web_search
   [FactCheckAgent] Attempting web search with tool type: web_search_preview
   ```

2. **Full response structure:**
   ```
   [FactCheckAgent] Full web search response structure: { ... }
   ```

3. **Content types found:**
   ```
   [FactCheckAgent] Web search response summary { contentTypes: [...] }
   ```

4. **Full response dump (if web search not found):**
   ```
   [FactCheckAgent] Response structure (web search not found): { ... }
   ```

### What to Check in Logs

1. **Which tool type works?**
   - Does `web_search` work but `web_search_preview` doesn't?
   - Or do both fail?

2. **What's in the response?**
   - What `contentTypes` are present?
   - Is there any indication web search was attempted?

3. **Response structure:**
   - Has the structure changed?
   - Is web search data in a different location?

## Quick Fix to Try

If you want to quickly test if `'web_search'` works (like the web app version):

**Temporarily change line 294 in `factCheckAgent.ts`:**
```typescript
// Change from:
tools: [{ type: 'web_search_preview' }],

// To:
tools: [{ type: 'web_search' }],
```

Then rebuild and test:
```bash
npm run build
npm run test:agents
```

## Expected Outcome

After these changes:

1. ✅ **Better visibility** - You'll see exactly what the API returns
2. ✅ **Automatic fallback** - Tries both tool types
3. ✅ **Graceful degradation** - Falls back to standard fact-checking if web search fails
4. ✅ **Diagnostic info** - Logs will show what changed

## If Web Search Still Doesn't Work

The enhanced logging will reveal:
- What tool type (if any) works
- What the actual response structure is
- Whether OpenAI changed the API behavior

Then we can:
- Update the code to match the new API format
- Or implement alternative web search (Google/Bing API)

---

**Status:** Enhanced debugging added, ready to diagnose the issue
**Next:** Run tests and check logs for detailed response information

