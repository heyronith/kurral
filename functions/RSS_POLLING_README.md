# RSS Polling for Breaking News Automation

This feature automatically polls RSS feeds from major news sources and posts breaking news to the Kural News platform account (`@kuralnews`).

## Overview

The system:
1. **Polls RSS feeds** every 5 minutes from configured news sources
2. **Detects breaking news** using keyword matching and recency checks
3. **Deduplicates articles** to avoid reposting
4. **Automatically posts** to the Kural News account

## Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Ensure Kural News Account Exists

Make sure the Kural News platform account is created:

```bash
node scripts/create-platform-accounts.js
```

This creates the `@kuralnews` account with:
- Handle: `kuralnews`
- Email: `news@kurral.app` (or from `KURAL_NEWS_EMAIL` env var)
- Platform account type: `news`

### 3. Deploy Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

## Configuration

### RSS Feeds

RSS feeds are configured in `functions/src/index.ts` in the `RSS_FEEDS` array:

```typescript
const RSS_FEEDS: RSSFeed[] = [
  { url: 'https://feeds.bbci.co.uk/news/rss.xml', name: 'BBC News', enabled: true },
  { url: 'https://feeds.reuters.com/reuters/topNews', name: 'Reuters Top News', enabled: true },
  // ... more feeds
];
```

To add/remove feeds, edit this array and redeploy.

### Breaking News Detection

Breaking news is detected by:
1. **Keyword matching**: Articles with "breaking", "urgent", "developing", etc. in the title
2. **Recency check**: Articles published in the last 10 minutes with breaking keywords in description/content

Keywords are configured in `BREAKING_KEYWORDS` array.

## How It Works

### Scheduled Function

The `pollRSSFeedsCron` function runs every 5 minutes:
- Polls all enabled RSS feeds
- Filters for breaking news
- Posts to `@kuralnews` account
- Tracks processed articles in Firestore

### Manual Trigger

You can manually trigger polling for testing:

```javascript
// From client code
const functions = getFunctions();
const pollRSS = httpsCallable(functions, 'pollRSSFeedsManual');
await pollRSS();
```

### Firestore Collections

The system uses two Firestore collections:

1. **`rssFeeds`** - Stores feed configuration and last checked timestamp
   - Document ID: feed URL
   - Fields: `url`, `name`, `enabled`, `lastChecked`

2. **`processedArticles`** - Tracks processed articles to prevent duplicates
   - Document ID: generated article ID
   - Fields: `articleId`, `feedUrl`, `title`, `link`, `pubDate`, `processedAt`

### Post Format

Posts are formatted as:
```
📰 [Article Title]

[Description if space permits]

Source: [Feed Name]
[Article Link]
```

Posts are limited to 280 characters and posted with:
- Topic: `news`
- Reach mode: `forAll`
- Author: Kural News platform account

## Monitoring

### Logs

View Cloud Function logs:

```bash
firebase functions:log --only pollRSSFeedsCron
```

### Firestore Queries

Check processed articles:
```javascript
// Get recent processed articles
db.collection('processedArticles')
  .orderBy('processedAt', 'desc')
  .limit(10)
  .get();
```

Check feed status:
```javascript
// Get all feed statuses
db.collection('rssFeeds').get();
```

## Troubleshooting

### No Posts Being Created

1. **Check Kural News account exists:**
   ```bash
   node scripts/verify-platform-accounts.js
   ```

2. **Check function logs:**
   ```bash
   firebase functions:log
   ```

3. **Verify feeds are enabled** in the `RSS_FEEDS` configuration

4. **Check for breaking news** - The system only posts articles that match breaking news criteria

### Duplicate Posts

- The system uses article IDs based on URL + publish date
- If duplicates occur, check the `processedArticles` collection
- Clear old processed articles if needed (older than 24 hours)

### Feed Errors

- Some RSS feeds may be temporarily unavailable
- Errors are logged but don't stop processing of other feeds
- Check individual feed URLs manually to verify they're accessible

## Customization

### Adjust Polling Frequency

Edit the schedule in `pollRSSFeedsCron`:

```typescript
schedule: 'every 5 minutes', // Change to 'every 1 minutes', 'every 10 minutes', etc.
```

### Modify Breaking News Criteria

Edit `BREAKING_KEYWORDS` array or the `isBreakingNews()` function logic.

### Change Post Format

Modify the `formatArticleForPost()` function to customize how articles are formatted.

## Security Notes

- The Cloud Function uses Firebase Admin SDK (bypasses security rules)
- Only authenticated users can trigger the manual function
- Posts are created with `isAutomatedPost: true` flag for identification
- The Kural News account must exist and be properly configured

