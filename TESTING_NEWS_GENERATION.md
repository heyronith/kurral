# Testing News Generation Feature

This guide explains how to test the AI-powered news generation feature end-to-end.

## Quick Test (Automated)

Run the automated test script:

```bash
npm run test:news
```

This script will:
1. ✅ Create 15+ posts for the "dev" topic
2. ✅ Update topic velocity tracking
3. ✅ Calculate if topic is trending
4. ✅ Check for AI-generated news

**Note:** The script creates the posts, but news generation is triggered when you refresh news in the app.

> **Personalization requirement:** Make sure your current user profile has at least one topic/tag selected (Profile → Edit → Topics). The news pipeline analyzes posts from your chosen tags to create personalized stories.

## Manual Testing Steps

### Step 1: Create Test Posts

Run the automated script first:
```bash
npm run test:news
```

Or manually create posts in the app:
1. Post 10-15 chirps about the same topic (e.g., "dev")
2. Space them out over a few minutes
3. This simulates a trending topic

### Step 2: Verify Topic is Trending

Check the browser console for logs like:
```
[NewsService] Found X trending topics
[NewsService] Generating AI news for trending topic: dev (X posts/hour)
```

Or check Firestore:
- Go to Firebase Console → Firestore
- Check `topics/dev` document
- Verify `isTrending: true` and `postsLast1h >= 5`

### Step 3: Trigger News Generation

In the app:
1. Go to the "Today's News" section in the right panel
2. Click the refresh button (circular arrow icon)
3. Wait for news to load (may take 10-30 seconds for AI generation)

### Step 4: Verify AI-Generated News

Look for:
- News items with source "Platform Discussion"
- Headlines generated from your posts
- Engagement counts showing post activity
- News appearing in the "Today's News" section

### Step 5: Test Detail View

1. Click on an AI-generated news item
2. Verify:
   - ✅ Title and description are shown
   - ✅ Composer appears above tabs
   - ✅ "Top" and "Latest" tabs work
   - ✅ Related posts are shown below
   - ✅ Posts match the news topic/keywords

## Expected Behavior

### When Topic is Trending:
- Topic has `isTrending: true` in Firestore
- `postsLast1h >= 5` (at least 5 posts in last hour)
- Velocity spike detected (1h rate ≥ 2x average)

### When News is Generated:
- News appears in `trendingNews` collection
- Source is "Platform Discussion"
- Title is AI-generated from posts
- Description is 280 characters or less
- Engagement count matches topic's `postsLast1h`

## Troubleshooting

### Topic Not Trending?
- **Issue:** `isTrending: false` even with many posts
- **Solution:** 
  - Create more posts (20+)
  - Ensure posts are within last hour
  - Check `averageVelocity1h` calculation
  - Try: `npm run test:news` with more posts

### No AI News Generated?
- **Issue:** News refresh doesn't create AI news
- **Check:**
  1. Is topic trending? (`isTrending: true`)
  2. Does topic have ≥5 posts in last hour?
  3. Is OpenAI API key configured? (`VITE_OPENAI_API_KEY`)
  4. Check browser console for errors
  5. Check network tab for OpenAI API calls

### News Generation Takes Too Long?
- **Normal:** 10-30 seconds for AI generation
- **If > 1 minute:**
  - Check OpenAI API status
  - Verify API key is valid
  - Check browser console for errors
  - May be rate limited

### Posts Not Matching News?
- **Issue:** Related posts don't show up in detail view
- **Check:**
  - News keywords match post content
  - Posts are in the same topic
  - Posts exist in Firestore

## Advanced Testing

### Test Multiple Topics

Modify the test script to test different topics:

```javascript
// In test-news-generation.js, change:
const testTopic = 'startups'; // or 'politics', 'crypto', etc.
```

### Test Velocity Calculation

Create posts with specific timing:
- 10 posts in last 30 minutes = high velocity
- 5 posts in last hour = moderate velocity
- 2 posts in last hour = low velocity (won't trend)

### Test News Quality

Check generated news:
- Headline is clear and factual
- Description is comprehensive
- Key facts are extracted correctly
- Confidence score is reasonable (>0.5)

## Verification Checklist

After running tests, verify:

- [ ] Posts created successfully in Firestore
- [ ] Topic engagement updated (postsLast1h, postsLast4h)
- [ ] Topic marked as trending (isTrending: true)
- [ ] AI news generated in trendingNews collection
- [ ] News appears in UI "Today's News" section
- [ ] News detail view shows title and description
- [ ] Related posts appear below news
- [ ] Engagement counts are accurate

## Cost Considerations

Each AI news generation:
- Uses OpenAI API (~$0.01-0.05 per generation)
- Only generates for trending topics (≥5 posts/hour)
- Generates up to 3 news items from top trending topics
- Cached for 3 hours

**Estimated cost:** < $0.50/month for normal usage

