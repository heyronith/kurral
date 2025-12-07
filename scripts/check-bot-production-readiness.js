/**
 * Production Readiness Check for AI Bot Feature
 * Verifies all components are properly configured for production deployment
 * 
 * Usage: node scripts/check-bot-production-readiness.js
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: [],
};

function log(message, type = 'info') {
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function check(condition, message, isWarning = false) {
  if (condition) {
    checks.passed++;
    log(message, 'success');
  } else {
    if (isWarning) {
      checks.warnings++;
      checks.issues.push(`WARNING: ${message}`);
      log(message, 'warning');
    } else {
      checks.failed++;
      checks.issues.push(`FAILED: ${message}`);
      log(message, 'error');
    }
  }
}

// Check 1: Environment Variables
log('\n=== Environment Variables ===', 'info');
const newsApiKey = process.env.VITE_NEWS_API_KEY;
check(!!newsApiKey, 'VITE_NEWS_API_KEY is set', false);
if (newsApiKey) {
  check(newsApiKey.length >= 20, `API key length is valid (${newsApiKey.length} chars)`, false);
  check(newsApiKey.startsWith('pub_') || newsApiKey.length >= 32, 'API key format appears valid for newsdata.io', true);
}

const pipelineInterval = process.env.VITE_NEWS_PIPELINE_INTERVAL_MS;
const posterInterval = process.env.VITE_BOT_POSTER_INTERVAL_MS;

check(!!pipelineInterval || pipelineInterval === '0', 'VITE_NEWS_PIPELINE_INTERVAL_MS is set (or 0 for single run)', true);
if (pipelineInterval) {
  const interval = Number(pipelineInterval);
  check(interval >= 0, `Pipeline interval is valid: ${interval}ms`, false);
  if (interval > 0) {
    const hours = interval / (1000 * 60 * 60);
    check(hours >= 1, `Pipeline interval is reasonable (${hours.toFixed(1)} hours)`, true);
  }
}

check(!!posterInterval, 'VITE_BOT_POSTER_INTERVAL_MS is set', true);
if (posterInterval) {
  const interval = Number(posterInterval);
  check(interval >= 15000, `Poster interval is >= 15s (${interval}ms) to avoid rate limits`, false);
}

// Check 2: Firebase Configuration
log('\n=== Firebase Configuration ===', 'info');
check(!!process.env.VITE_FIREBASE_API_KEY, 'VITE_FIREBASE_API_KEY is set', false);
check(!!process.env.VITE_FIREBASE_PROJECT_ID, 'VITE_FIREBASE_PROJECT_ID is set', false);
check(!!process.env.VITE_FIREBASE_AUTH_DOMAIN, 'VITE_FIREBASE_AUTH_DOMAIN is set', false);

// Check 3: Service Files
log('\n=== Service Files ===', 'info');
import { existsSync } from 'fs';
const serviceFiles = [
  'src/webapp/lib/services/botService.ts',
  'src/webapp/lib/services/newsApiService.ts',
  'src/webapp/lib/services/botRoutingService.ts',
  'src/webapp/lib/services/botPostService.ts',
  'src/webapp/lib/services/newsPipelineService.ts',
  'src/webapp/lib/services/botConfig.ts',
];

serviceFiles.forEach(file => {
  check(existsSync(join(__dirname, '..', file)), `${file} exists`, false);
});

// Check 4: Production Considerations
log('\n=== Production Considerations ===', 'info');

// Check if pipeline interval is set for production (should be > 0 for continuous operation)
if (pipelineInterval) {
  const interval = Number(pipelineInterval);
  if (interval === 0) {
    check(false, 'Pipeline interval is 0 (single run mode). Set VITE_NEWS_PIPELINE_INTERVAL_MS for continuous operation in production.', true);
  } else {
    check(true, `Pipeline interval is set for continuous operation (${(interval / (1000 * 60 * 60)).toFixed(1)} hours)`, false);
  }
}

// Check rate limit handling
check(!!posterInterval && Number(posterInterval) >= 15000, 'Poster interval is sufficient to avoid rate limits', false);

// Summary
log('\n' + '='.repeat(60), 'info');
log('📊 Production Readiness Summary', 'info');
log('='.repeat(60), 'info');
log(`✅ Passed: ${checks.passed}`, 'success');
log(`⚠️  Warnings: ${checks.warnings}`, checks.warnings > 0 ? 'warning' : 'info');
log(`❌ Failed: ${checks.failed}`, checks.failed > 0 ? 'error' : 'info');

if (checks.issues.length > 0) {
  log('\n📋 Issues Found:', 'info');
  checks.issues.forEach(issue => log(`   ${issue}`, issue.startsWith('FAILED') ? 'error' : 'warning'));
}

const total = checks.passed + checks.failed + checks.warnings;
const successRate = total > 0 ? ((checks.passed / total) * 100).toFixed(1) : 0;

log(`\n📈 Success Rate: ${successRate}%`, 'info');
log('='.repeat(60), 'info');

if (checks.failed === 0) {
  log('🎉 Production readiness check passed!', 'success');
  if (checks.warnings > 0) {
    log('⚠️  Review warnings above before deploying.', 'warning');
  }
  process.exit(0);
} else {
  log('❌ Production readiness check failed. Fix issues above before deploying.', 'error');
  process.exit(1);
}

