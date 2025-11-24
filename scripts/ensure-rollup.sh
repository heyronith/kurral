#!/bin/bash
# Ensure Rollup native dependencies are installed
# This fixes the npm optional dependencies bug on Vercel

if [ ! -d "node_modules/@rollup/rollup-linux-x64-gnu" ]; then
  echo "Installing Rollup native dependency for Linux x64..."
  npm install --no-save @rollup/rollup-linux-x64-gnu || echo "Warning: Could not install rollup native dependency"
fi

