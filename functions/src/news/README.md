# GNews News Module (Kural News)

Automated news posting from GNews API to the **Kural News** (@kuralnews) account.

## Step 1: News Module ✅

- **types.ts** – GNews article types, config, categories
- **gnewsClient.ts** – Fetch top headlines by category (with 1.5s delay between categories to avoid 429)
- **deduplication.ts** – URL normalization, `processedArticles` collection, chirp IDs `gnews_<hash>`
- **postNews.ts** – Resolve Kural News user ID, format article as chirp, write to `chirps`
- **index.ts** – `runNewsPoll()`, `getNewsConfigFromEnv()`, exports

## Step 2: Scheduler ✅

- **pollGNewsCron** – Scheduled every 15 minutes (Firebase v2 scheduler)
- **pollGNewsManual** – HTTPS callable to run one poll (auth required)

## Step 3: Deploy, Config, Monitor, Go Live

### 1. Set GNews API key (required before deploy)

Use Secret Manager (recommended; `functions.config()` is deprecated):

```bash
firebase functions:secrets:set GNEWS_API_KEY
```

When prompted, paste your GNews API key. Then deploy so the functions can access it.

### 2. Deploy functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

This deploys `pollGNewsCron` and `pollGNewsManual` with the rest of your functions.

### 3. Monitor

- **Logs**: Firebase Console → Functions → select `pollGNewsCron` or `pollGNewsManual` → Logs.
- **Cron**: Each run logs `[pollGNewsCron] Completed` with:
  - `articlesFetched`, `articlesAfterAgeFilter`, `articlesAfterDedup`, `chirpsCreated`, `durationMs`, `errorCount`.
- **Manual run**: Call `pollGNewsManual` from your app (authenticated) and inspect the returned stats.

### 4. Go-live checklist

- [ ] GNews API key set via `firebase functions:secrets:set GNEWS_API_KEY`
- [ ] Kural News user exists in Firestore with `handle === 'kuralnews'` and `isPlatformAccount === true`
- [ ] Deploy: `firebase deploy --only functions`
- [ ] Trigger once manually (e.g. from your app via `pollGNewsManual`) and confirm 2 chirps created (or 0 if all deduped)
- [ ] Check Firebase Console → Functions → `pollGNewsCron` is enabled and runs every 15 minutes
- [ ] Watch logs for 24h for 429s or errors; if 429s persist, reduce categories or increase delay in `gnewsClient.ts`

### Local test (no deploy)

```bash
cd functions
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
# GNEWS_API_KEY from .env or:
export GNEWS_API_KEY=your_key
npm run test:news-poll
```
