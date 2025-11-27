#!/bin/bash

# Run all tests in sequence
# This script runs authentication tests first, then uses those credentials for persistence tests

echo "🚀 Running all tests..."
echo ""

# Run authentication tests
echo "=== Authentication Tests ==="
npm run test:auth

if [ $? -ne 0 ]; then
    echo "❌ Authentication tests failed. Stopping."
    exit 1
fi

echo ""
echo "=== Data Persistence Tests ==="
echo "Note: This will create a new test user if TEST_EMAIL and TEST_PASSWORD are not set in .env"
echo ""

npm run test:persistence

if [ $? -ne 0 ]; then
    echo "❌ Persistence tests failed."
    exit 1
fi

echo ""
echo "=== For You Feed Algorithm Tests ==="
echo ""

npm run test:for-you-feed

if [ $? -ne 0 ]; then
    echo "❌ For You Feed tests failed."
    exit 1
fi

echo ""
echo "=== For You Feed Instruction Parsing Tests ==="
echo ""

npm run test:for-you-instructions

if [ $? -ne 0 ]; then
    echo "❌ For You Feed instruction tests failed."
    exit 1
fi

echo ""
echo "=== For You Feed Controls Tests (Presets & NL Fine-tuning) ==="
echo "Note: Requires VITE_OPENAI_API_KEY to be set for full testing"
echo ""

npm run test:for-you-controls

if [ $? -ne 0 ]; then
    echo "❌ For You Feed Controls tests failed."
    exit 1
fi

echo ""
echo "=== Trending News Deduplication Tests ==="
echo "Testing duplication bug fix and deduplication logic"
echo ""

npm run test:trending-news-dedup

if [ $? -ne 0 ]; then
    echo "❌ Trending News Deduplication tests failed."
    exit 1
fi

echo ""
echo "✅ All automated tests passed!"
echo ""
echo "📋 Next: Test real-time updates manually in browser (requires two tabs)"

