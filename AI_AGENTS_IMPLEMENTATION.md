# AI Agents Implementation - Complete End-to-End

## Overview

This document describes the complete AI agents system implemented using OpenAI. The system includes three specialized agents that power intelligent features throughout the app.

## Architecture

### Base Agent (`lib/agents/baseAgent.ts`)
- Foundation for all AI agents
- Handles OpenAI API connection and configuration
- Provides `generate()` and `generateJSON()` methods
- Automatically falls back to heuristics if API key is not configured

### Three Specialized Agents

1. **Reach Agent** (`lib/agents/reachAgent.ts`)
   - Purpose: Suggests optimal reach settings for chirps in composer
   - When used: When user selects "Tuned" mode and types content
   - Features: Analyzes content intent, tone, and suggests audience settings
   - Fallback: Heuristic-based suggestions if AI unavailable

2. **Tuning Agent** (`lib/agents/tuningAgent.ts`)
   - Purpose: Learns user behavior and suggests algorithm improvements
   - When used: Background analysis (periodic, every 24 hours)
   - Features: Analyzes engagement patterns, suggests better weights/topics
   - Output: Suggestions for following weight, liked/muted topics, conversation boosts

3. **Search Agent** (`lib/agents/searchAgent.ts`)
   - Purpose: Semantic search understanding and result ranking
   - When used: When user searches for content
   - Features: Understands query intent, ranks results by relevance
   - Fallback: Keyword-based search if AI unavailable

## Implementation Details

### 1. Reach Suggestions in Composer

**Location**: `components/Composer.tsx`

**How it works**:
- User types in composer and selects "Tuned" mode
- 800ms debounce triggers AI analysis
- Reach Agent analyzes content and topic
- Suggests optimal audience settings (followers/non-followers/topic match)
- User can accept or ignore suggestion

**Key Features**:
- Real-time suggestions with loading states
- Graceful fallback to heuristics
- User control (can accept/ignore)

### 2. Semantic Search

**Location**: `components/SearchResults.tsx`, `components/RightPanel.tsx`

**How it works**:
- User types in search box (RightPanel)
- Search Agent understands query intent
- Ranks results by semantic relevance (0-1 score)
- Displays results with explanations

**Key Features**:
- 500ms debounce for performance
- Semantic understanding, not just keywords
- Relevance scoring and explanations
- Fallback to keyword search

### 3. Algorithm Tuning Service

**Location**: `lib/services/tuningService.ts`, `components/TuningSuggestionModal.tsx`

**How it works**:
- Background service tracks user behavior:
  - Chirps viewed (localStorage)
  - Chirps engaged with (comments, likes)
- Every 24 hours, analyzes behavior patterns
- Suggests improvements to algorithm weights
- Shows modal with suggestions (if confidence >= 50%)

**Key Features**:
- Automatic behavior tracking
- Periodic analysis (every hour check, every 24h analysis)
- Confidence-based suggestions
- User can apply or dismiss suggestions

### 4. Behavior Tracking

**Location**: `components/ChirpCard.tsx`, `components/CommentSection.tsx`

**What's tracked**:
- Chirp views (when chirp appears in feed)
- Chirp engagement (when user comments)
- Stored in localStorage (last 1000 viewed, last 500 engaged)

## File Structure

```
src/webapp/
├── lib/
│   ├── agents/
│   │   ├── baseAgent.ts          # Base OpenAI client
│   │   ├── reachAgent.ts         # Reach suggestions agent
│   │   ├── tuningAgent.ts        # Algorithm tuning agent
│   │   └── searchAgent.ts        # Search agent
│   └── services/
│       └── tuningService.ts      # Background tuning service
├── components/
│   ├── Composer.tsx              # Updated with AI reach suggestions
│   ├── SearchResults.tsx         # New: Semantic search results
│   ├── TuningSuggestionModal.tsx # New: Algorithm tuning modal
│   ├── ChirpCard.tsx             # Updated: Behavior tracking
│   └── CommentSection.tsx        # Updated: Engagement tracking
├── store/
│   └── useSearchStore.ts         # New: Search state management
└── pages/
    └── ChirpApp.tsx              # Updated: Tuning service integration
```

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# OpenAI (required for AI features)
VITE_OPENAI_API_KEY=your_openai_api_key
```

### Getting OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in with your OpenAI account
3. Click "Create new secret key"
4. Copy and paste into `.env`

**Note**: If API key is not set, all features gracefully fall back to heuristic-based approaches.

**Security Note**: The API key is exposed in the browser client. For production, consider using a backend proxy to protect your API key.

## Usage Examples

### Reach Suggestions
1. Open composer
2. Type chirp content
3. Select topic
4. Switch to "Tuned" mode
5. Wait ~1 second for AI suggestion
6. Review and accept/ignore

### Semantic Search
1. Type query in search box (RightPanel)
2. Wait ~500ms for results
3. View ranked results with relevance scores

### Algorithm Tuning
1. Use app normally (views/engagements tracked automatically)
2. After 24 hours with engagement data, modal appears
3. Review suggestions with confidence scores
4. Apply or dismiss suggestions

## Error Handling

All agents include comprehensive error handling:

- **API failures**: Fall back to heuristic-based approaches
- **Missing API key**: Features work with fallbacks
- **Network errors**: Logged, graceful degradation
- **Invalid responses**: Parsed safely with validation

## Performance Considerations

- **Debouncing**: Search (500ms), Reach suggestions (800ms)
- **Caching**: Tuning suggestions cached in localStorage
- **Lazy loading**: Agents only instantiated when needed
- **Background processing**: Tuning analysis runs asynchronously

## Future Enhancements

Potential improvements:
- Server-side API calls for better performance
- User feedback on suggestions (thumbs up/down)
- Multi-model support (fallback chains)
- Custom fine-tuning for your domain
- Real-time learning from user actions

## Testing

To test the implementation:

1. **Reach Suggestions**: 
   - Type various content types (questions, announcements, personal)
   - Verify AI understands context

2. **Search**:
   - Try semantic queries like "discussions about React"
   - Verify relevance ranking works

3. **Tuning**:
   - Engage with various topics
   - Wait for suggestions (or manually trigger analysis)
   - Verify suggestions make sense

## Dependencies

- `@google/generative-ai`: ^0.21.0 (installed)
- All other dependencies unchanged

## Status

✅ **Fully Implemented and Functional**
- All three agents complete
- Integration with existing UI
- Error handling and fallbacks
- Documentation complete

