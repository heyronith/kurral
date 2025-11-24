# Step 2 Testing Guide

## Quick Start

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   - The terminal will show a URL (usually `http://localhost:5173`)
   - Open that URL in your browser

3. **Navigate to the app section:**
   - Scroll down to the "Try Chirp" section
   - Or use the anchor link if available

---

## Testing Checklist

### ✅ 1. Test Composer - Posting Chirps

**Test Creating a New Chirp:**
1. ✅ Type some text in the composer (e.g., "Just testing the new composer!")
2. ✅ Select a topic by clicking one of the topic chips (e.g., #dev, #startups)
3. ✅ Verify character counter shows remaining characters (starts at 280)
4. ✅ Try typing more than 280 characters - should stop at limit
5. ✅ Click "Post" button
6. ✅ **Expected:** 
   - Chirp appears immediately in the Latest feed at the top
   - Composer resets (text cleared, topic deselected)
   - Character counter resets to 280

**Test Reach Settings - For All:**
1. ✅ Select "For All" mode (should be default)
2. ✅ Create a chirp
3. ✅ **Expected:** Chirp shows "Reach: For All" label

**Test Reach Settings - Tuned:**
1. ✅ Click "Tuned" mode button
2. ✅ Check/uncheck the toggles:
   - Followers
   - Non-followers
   - Topic match
3. ✅ Create a chirp
4. ✅ **Expected:** 
   - Chirp shows "Reach: Tuned (followers, non-followers, topic match)" or similar
   - Label reflects which toggles were checked

**Test Validation:**
1. ✅ Try posting without text - Post button should be disabled
2. ✅ Try posting without selecting a topic - Post button should be disabled
3. ✅ **Expected:** Button is grayed out and not clickable

---

### ✅ 2. Test Latest Feed

**Test Feed Display:**
1. ✅ Scroll to Latest feed section
2. ✅ **Expected:**
   - See "Because: Latest – pure chronological" label at top
   - Chirps are sorted newest first (most recent at top)
   - Each chirp shows:
     - Author name and handle
     - Relative time (now, 5m, 2h, etc.)
     - Full text content
     - Topic chip (e.g., #dev)
     - Reach label

**Test Feed Updates:**
1. ✅ Post a new chirp from composer
2. ✅ **Expected:**
   - New chirp appears at the very top of Latest feed
   - Feed updates immediately (no page refresh needed)
   - Your own chirps appear in the feed

**Test Following Filter:**
1. ✅ Note which users you're currently following (from mock data)
2. ✅ **Expected:**
   - Latest feed only shows chirps from users you follow
   - Your own chirps also appear
   - Chirps from non-followed users don't appear

---

### ✅ 3. Test Follow/Unfollow Functionality

**Test Following a User:**
1. ✅ Find a chirp from a user you're not following
2. ✅ Click the "Follow" button on that chirp
3. ✅ **Expected:**
   - Button changes to "Following" with different styling
   - That user's chirps now appear in your Latest feed
   - Feed updates immediately

**Test Unfollowing a User:**
1. ✅ Find a chirp from a user you're following
2. ✅ Click the "Following" button
3. ✅ **Expected:**
   - Button changes back to "Follow"
   - That user's chirps disappear from Latest feed
   - Feed updates immediately

**Test Edge Cases:**
1. ✅ Try to follow/unfollow on your own chirp
2. ✅ **Expected:** No Follow button appears on your own chirps

---

### ✅ 4. Test Reach Settings Display

**Test For All Chirps:**
1. ✅ Create a chirp with "For All" mode
2. ✅ **Expected:** Shows "Reach: For All" label

**Test Tuned Chirps:**
1. ✅ Create chirps with different Tuned settings:
   - Only Followers checked
   - Only Non-followers checked
   - All three checked
   - None checked
2. ✅ **Expected:** Label accurately reflects the settings:
   - "Reach: Tuned (followers)"
   - "Reach: Tuned (non-followers)"
   - "Reach: Tuned (followers, non-followers, topic match)"
   - "Reach: Tuned" (if none checked)

---

## Advanced Testing Scenarios

### Scenario 1: Multiple Posts
1. Post 3-4 chirps in quick succession
2. **Expected:** All appear in chronological order (newest first)

### Scenario 2: Follow/Unfollow Impact
1. Follow a user, verify their chirps appear
2. Unfollow them, verify their chirps disappear
3. Follow again, verify they reappear

### Scenario 3: Mixed Reach Settings
1. Create chirps with different reach settings
2. **Expected:** All display correctly with appropriate labels

### Scenario 4: Character Limit
1. Type exactly 280 characters
2. **Expected:** Can still post
3. Try to type 281st character
4. **Expected:** Input stops at 280

---

## Browser Console Checks

Open browser DevTools (F12) and check:

1. **No Errors:**
   - Console should be clean (no red errors)
   - Any warnings are acceptable

2. **State Updates:**
   - When posting, you might see Zustand state updates
   - This is normal

---

## Common Issues & Solutions

### Issue: Chirps not appearing after posting
**Solution:** 
- Check browser console for errors
- Verify you're on the "Latest" tab (not "For You")
- Make sure you selected a topic before posting

### Issue: Follow button not working
**Solution:**
- Check browser console for errors
- Verify you're not trying to follow yourself
- Refresh the page and try again

### Issue: Feed not updating
**Solution:**
- The feed should update automatically
- If not, check that Zustand stores are properly connected
- Try refreshing the page

---

## Expected Behavior Summary

✅ **Composer:**
- Can type up to 280 characters
- Must select topic to post
- Can choose reach mode (For All / Tuned)
- Form resets after posting
- Post button disabled when invalid

✅ **Latest Feed:**
- Shows only followed users' chirps + own chirps
- Sorted newest first
- Updates immediately when new chirp posted
- Shows all metadata correctly

✅ **Follow/Unfollow:**
- Button appears on others' chirps
- Button hidden on own chirps
- Feed updates immediately when following changes
- Button state reflects current following status

✅ **Reach Settings:**
- Stored correctly with each chirp
- Displayed accurately on chirp cards
- Tuned mode shows detailed breakdown

---

## Quick Test Script

Run through this quick sequence:

1. ✅ Post a chirp: "Hello world!" with topic #dev, For All mode
2. ✅ Verify it appears at top of Latest feed
3. ✅ Post another: "Second test" with topic #startups, Tuned mode (all toggles on)
4. ✅ Verify it appears above the first one
5. ✅ Find a chirp from another user, click Follow
6. ✅ Verify that user's chirps appear in feed
7. ✅ Click Following to unfollow
8. ✅ Verify their chirps disappear

If all these work, Step 2 is functioning correctly! 🎉

