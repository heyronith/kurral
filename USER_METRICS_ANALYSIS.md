# User Activity Metrics Analysis

## Overview
This document lists all metrics currently calculated and tracked for user activity on the platform.

---

## 1. Kurral Score Metrics (0-100 Scale)

### Overall Score
- **Current Score**: 0-100 (starting at 65 for new users)
- **Last Updated**: Timestamp of last score calculation
- **Score History**: Last 20 score changes with:
  - Score value
  - Delta (change amount)
  - Reason for change
  - Date of change

### Score Components (0-100 each)
- **Quality History**: Weighted average of content quality (40% weight)
- **Violation History**: Penalty score based on violations (25% weight, lower is better)
- **Engagement Quality**: Discussion and engagement metrics (15% weight)
- **Consistency**: Activity consistency over time (10% weight)
- **Community Trust**: Trust and policy compliance (10% weight)

### Score Tiers
- **Excellent**: 88-100
- **Good**: 77-87 (monetization eligible)
- **Fair**: 65-76
- **Poor**: 53-64
- **Very Poor**: 0-52

---

## 2. Value Statistics

### 30-Day Rolling Metrics
- **Post Value (30d)**: Sum of all post value scores from last 30 days
- **Comment Value (30d)**: Sum of all comment value scores from last 30 days
- **Total Value (30d)**: Combined post + comment value

### Lifetime Metrics
- **Lifetime Post Value**: Cumulative total of all post values ever created
- **Lifetime Comment Value**: Cumulative total of all comment values ever created
- **Total Lifetime Value**: Combined lifetime post + comment value

### Update Tracking
- **Last Updated**: Timestamp when value stats were last recalculated

---

## 3. Reputation Metrics

### Domain-Specific Reputation
- **Reputation by Domain**: Record<string, number> mapping domains to reputation scores
- **Domains Tracked**: health, finance, politics, technology, science, society, general
- **Calculation**: Based on value contributions per domain

---

## 4. Activity Metrics (Calculable)

### Content Creation
- **Total Posts**: Count of all posts created by user
- **Total Comments**: Count of all comments created by user
- **Average Post Value**: Average value score across all posts
- **Average Comment Value**: Average value score across all comments

### Social Metrics
- **Following Count**: Number of users this user follows (user.following.length)
- **Followers Count**: Number of users who follow this user (calculated from other users' following arrays)
- **Bookmarks Count**: Number of posts bookmarked (user.bookmarks?.length)

### Account Metrics
- **Account Age**: Days since account creation (calculated from createdAt)
- **Account Created**: Timestamp of account creation

---

## 5. Post-Level Metrics (Aggregatable)

### Value Distribution
- **Posts by Value Range**: Distribution of posts across value score ranges
- **High-Value Posts**: Count of posts with value > 0.7
- **Low-Value Posts**: Count of posts with value < 0.3

### Fact-Check Metrics
- **Clean Posts**: Count of posts with 'clean' policy status
- **Needs Review Posts**: Count of posts with 'needs_review' status
- **Blocked Posts**: Count of posts with 'blocked' status
- **Verified Claims**: Total count of verified true claims
- **False Claims**: Total count of false claims (high confidence)
- **Unverified Claims**: Total count of unverified claims

### Engagement Metrics
- **Total Comments Received**: Comments on user's posts
- **Average Discussion Quality**: Average discussion quality scores
- **High-Quality Discussions**: Count of discussions with quality > 0.7

---

## 6. Time-Based Metrics (Calculable)

### Recent Activity (Last 7 Days)
- **Posts Created**: Count
- **Comments Created**: Count
- **Value Generated**: Total value from recent activity

### Recent Activity (Last 30 Days)
- **Posts Created**: Count
- **Comments Created**: Count
- **Value Generated**: Total value (already tracked in valueStats.postValue30d + commentValue30d)

### Activity Trends
- **Posting Frequency**: Posts per week/month
- **Commenting Frequency**: Comments per week/month
- **Activity Consistency**: Regularity of posting/commenting

---

## 7. Monetization Metrics

### Eligibility Status
- **Is Eligible**: Boolean (score >= 77 AND account age >= 30 days)
- **Score Requirement Met**: Boolean (score >= 77)
- **Age Requirement Met**: Boolean (account age >= 30 days)

### Payment Metrics (Future)
- **Total Earnings**: Sum of all payments received
- **Pending Payments**: Payments queued but not yet processed
- **Average Payment per Post**: Total earnings / total posts
- **Payment History**: Record of all payments

---

## 8. Violation Metrics (Calculable)

### Policy Violations
- **Total Violations**: Count of all policy violations
- **Severe Violations**: Count of blocked posts
- **Moderate Violations**: Count of needs_review posts
- **Violations in Last 90 Days**: Recent violation count
- **Violation Rate**: Violations per post ratio

### Score Impact
- **Score Penalties**: Total score reduction from violations
- **Recovery Progress**: Score improvement since last violation

---

## 9. Content Quality Metrics (Calculable)

### Value Dimensions (Per Post, Aggregatable)
- **Average Epistemic Score**: Factual accuracy average
- **Average Insight Score**: Original thinking average
- **Average Practical Score**: Usefulness average
- **Average Relational Score**: Discussion value average
- **Average Effort Score**: Content depth average

### Quality Distribution
- **High-Quality Posts**: Posts with total value > 0.7
- **Medium-Quality Posts**: Posts with value 0.4-0.7
- **Low-Quality Posts**: Posts with value < 0.4

---

## 10. Engagement Metrics (Calculable)

### Discussion Participation
- **Comments Written**: Total count
- **Comments on Own Posts**: Count of comments on user's posts
- **Average Comment Value**: Average value contribution from comments

### Community Interaction
- **Posts with High Engagement**: Posts with >5 comments
- **Average Comments per Post**: Total comments / total posts
- **Discussion Quality Average**: Average discussion quality scores

---

## Data Sources

### Direct User Data (Firestore `users` collection)
- `kurralScore`: Complete score object with components and history
- `valueStats`: Post and comment value statistics
- `reputation`: Domain-specific reputation scores
- `following`: Array of followed user IDs
- `bookmarks`: Array of bookmarked post IDs
- `createdAt`: Account creation timestamp

### Calculated from Collections
- **Posts Count**: Query `chirps` collection by `authorId`
- **Comments Count**: Query `comments` collection by `authorId`
- **Followers Count**: Query `users` collection where `following` array contains user ID
- **Value Contributions**: Query `valueContributions` collection by `userId`

### Aggregated Metrics
- Average values calculated from individual post/comment scores
- Distribution metrics calculated from grouped queries
- Trend metrics calculated from time-series data

---

## Metrics Available for Dashboard

### Primary Metrics (Currently Stored)
1. Kurral Score (0-100) with components breakdown
2. Value Stats (30-day and lifetime)
3. Reputation by domain
4. Score history (last 20 changes)

### Secondary Metrics (Calculable on Demand)
5. Total posts count
6. Total comments count
7. Following/Followers count
8. Bookmarks count
9. Account age
10. Average post/comment values
11. Fact-check status distribution
12. Violation counts
13. Activity trends (7d, 30d)
14. Content quality distribution
15. Engagement metrics

### Future Metrics (Not Yet Implemented)
16. Payment/earnings data
17. Monetization eligibility details
18. Detailed violation history
19. Content performance analytics

---

## Recommended Dashboard Sections

1. **Overview**: Kurral Score, Value Stats summary, Monetization status
2. **Content Performance**: Posts/Comments counts, Average values, Quality distribution
3. **Engagement**: Discussion quality, Comments received, Engagement trends
4. **Reputation**: Domain-specific scores, Overall reputation trends
5. **Activity Trends**: Posting frequency, Value generation over time
6. **Score History**: Score changes over time with reasons
7. **Policy Compliance**: Violation history, Clean posts ratio
8. **Monetization**: Eligibility status, Payment history (when implemented)

