# Testing Reach Suggestions

## Quick Test Cases

### Test Case 1: Discussion/Question
**Content:** "What do you think about React 19? Should we migrate?"
**Topic:** `#dev`
**Expected:** Open to followers + non-followers with topic match

### Test Case 2: Personal/Private
**Content:** "I feel really stressed about my job today"
**Topic:** `#productivity`
**Expected:** Followers only, no topic match

### Test Case 3: Public Announcement
**Content:** "Announcing: We just launched our new product!"
**Topic:** `#startups`
**Expected:** Open to everyone (followers + non-followers)

### Test Case 4: Controversial Topic
**Content:** "My take on the latest crypto regulations"
**Topic:** `#crypto`
**Expected:** May require topic match for non-followers

## How to Verify AI is Working

1. **Check Browser Console** (F12 → Console tab)
   - If AI is working: You'll see network requests to Gemini API
   - If using fallback: You'll see warning messages about API key

2. **Response Time**
   - AI: ~1-3 seconds (makes API call)
   - Fallback: Instant (<100ms, uses heuristics)

3. **Suggestion Quality**
   - AI: More nuanced, contextual explanations
   - Fallback: Simple pattern matching

## Troubleshooting

### If suggestions don't appear:
- Make sure you're in "Tuned" mode (not "For All")
- Make sure you've typed at least a few characters
- Make sure a topic is selected
- Wait ~1 second after typing

### If AI isn't working:
- Check `.env` file has `VITE_GEMINI_API_KEY=your_actual_key`
- Make sure there's no `your_gemini_api_key_here` placeholder
- Restart dev server after changing `.env`
- Check browser console for errors

### To test fallback (without AI):
- Don't set `VITE_GEMINI_API_KEY` or set it to empty
- Suggestions will still work using heuristics

