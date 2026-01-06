# Shared Code

This directory contains code shared between the webapp and mobile applications.

## Structure

- `lib/algorithm.ts` - For You feed algorithm (shared between webapp and mobile)
- `lib/utils/similarity.ts` - Cosine similarity utility function

## Usage

Each app has wrapper files that import from this shared directory:

- **Webapp**: `src/webapp/lib/algorithm.ts` - Re-exports from shared
- **Mobile**: `mobile/src/lib/algorithm.ts` - Wrapper with type assertions for mobile types

## Notes

- The shared algorithm imports types from `../../src/webapp/types` as the base implementation
- Both apps have compatible type structures, so the algorithm works in both contexts
- When making changes to the algorithm, update `shared/lib/algorithm.ts` and both apps will automatically use the new version

