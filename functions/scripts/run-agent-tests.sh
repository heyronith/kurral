#!/bin/bash
# Script to test all agents in Firebase Cloud Functions environment

set -e

echo "🧪 Testing All Content Quality & Fact-Checking Agents"
echo "======================================================"
echo ""

# Check if we're in the functions directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from functions directory"
  exit 1
fi

# Build TypeScript
echo "📦 Building TypeScript..."
npm run build

# Run the test
echo ""
echo "🚀 Running agent tests..."
echo ""
node lib/scripts/test-all-agents.js

exit_code=$?

if [ $exit_code -eq 0 ]; then
  echo ""
  echo "✅ All tests passed!"
else
  echo ""
  echo "❌ Some tests failed. Check output above."
fi

exit $exit_code

