# All References to "Dumbfeed" in Codebase

## Summary
The codebase contains **8 references** to "dumbfeed" (all lowercase). The public-facing brand is **"Kurral"** (as seen in `index.html`), but "dumbfeed" is still used internally for:
- Package/project name
- LocalStorage cache keys
- Fallback user display name

---

## Detailed References

### 1. **package.json** (Line 2)
**File:** `/package.json`
```json
"name": "dumbfeed",
```
**Context:** NPM package name

---

### 2. **package-lock.json** (Lines 2, 8)
**File:** `/package-lock.json`
```json
"name": "dumbfeed",
...
"name": "dumbfeed",
```
**Context:** Lock file references to package name

---

### 3. **locationService.ts** (Line 1)
**File:** `src/webapp/lib/services/locationService.ts`
```typescript
const LOCATION_CACHE_KEY = 'dumbfeed:country-code';
```
**Context:** LocalStorage key prefix for caching country code detection

---

### 4. **locationService.js** (Line 1)
**File:** `src/webapp/lib/services/locationService.js`
```javascript
const LOCATION_CACHE_KEY = 'dumbfeed:country-code';
```
**Context:** JavaScript version of the same cache key

---

### 5. **useConfigStore.ts** (Line 7)
**File:** `src/webapp/store/useConfigStore.ts`
```typescript
const STORAGE_PREFIX = 'dumbfeed:forYouConfig';
```
**Context:** LocalStorage key prefix for storing user's "For You" feed configuration

---

### 6. **useConfigStore.js** (Line 5)
**File:** `src/webapp/store/useConfigStore.js`
```javascript
const STORAGE_PREFIX = 'dumbfeed:forYouConfig';
```
**Context:** JavaScript version of the same storage prefix

---

### 7. **DashboardSidebar.js** (Line 57)
**File:** `src/webapp/components/DashboardSidebar.js`
```javascript
const profileName = currentUser?.name ?? 'Dumbfeed creator';
```
**Context:** Fallback display name when user has no name set. This is user-facing text.

---

## Related References (Not "Dumbfeed" but related)

### "Why Dumb" Section
**Files:** 
- `src/components/WhyDumbSection.tsx` (Line 5)
- `src/components/WhyDumbSection.js` (Line 2)

**Content:** Explains the philosophy of "dumb" (transparent, predictable) vs "smart" (black-box algorithms). This is about the product philosophy, not the name "Dumbfeed".

---

## Branding Status

### Public Brand: **"Kurral"**
- **index.html** (Lines 16-50): All meta tags, title, and structured data use "Kurral"
- **Landing page components**: Reference "Kurral" as the platform name
- **ValuePropositionSection**: Uses "Kurral Score" terminology

### Internal/Technical: **"dumbfeed"**
- Package name
- LocalStorage keys (won't affect users unless they inspect browser storage)
- One fallback text string in DashboardSidebar

---

## Recommendations

1. **Update DashboardSidebar.js** (Line 57): Change `'Dumbfeed creator'` to `'Kurral creator'` or `'User'`
2. **Consider renaming package**: If rebranding is complete, consider updating `package.json` name (though this may break existing deployments)
3. **LocalStorage keys**: These are internal and don't need to change unless you want to migrate existing user data

---

## Files That Need Review

1. ✅ `src/webapp/components/DashboardSidebar.js` - **User-facing text, should be updated**
2. ⚠️ `package.json` - **Internal, but consider for consistency**
3. ⚠️ `package-lock.json` - **Auto-generated, will update if package.json changes**
4. ℹ️ LocalStorage keys - **Internal only, low priority**

