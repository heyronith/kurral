/**
 * Production Readiness Check for AI Bot Feature
 * Verifies all components are properly configured for production deployment
 * 
 * Usage: node scripts/check-production-readiness.js
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
      log(message, 'warning');
    } else {
      checks.failed++;
      checks.issues.push(message);
      log(message, 'error');
    }
  }
}

console.log('🔍 Production Readiness Check for AI Bot Feature\n');
console.log('='.repeat(60));

// 1. Environment Variables
console.log('\n📋 Environment Variables:');
check(!!process.env.VITE_FIREBASE_API_KEY, 'VITE_FIREBASE_API_KEY is set');
check(!!process.env.VITE_FIREBASE_PROJECT_ID, 'VITE_FIREBASE_PROJECT_ID is set');
check(!!process.env.VITE_NEWS_API_KEY, 'VITE_NEWS_API_KEY is set');
check(
  process.env.VITE_NEWS_API_KEY?.startsWith('pub_') || process.env.VITE_NEWS_API_KEY?.length >= 20,
  'VITE_NEWS_API_KEY format appears valid',
  true
);
check(!!process.env.VITE_OPENAI_API_KEY, 'VITE_OPENAI_API_KEY is set (for fact-checking)');

// 2. Service Configuration
console.log('\n⚙️  Service Configuration:');
const pipelineInterval = process.env.VITE_NEWS_PIPELINE_INTERVAL_MS;
const posterInterval = process.env.VITE_BOT_POSTER_INTERVAL_MS;

check(
  pipelineInterval === undefined || Number(pipelineInterval) >= 0,
  'VITE_NEWS_PIPELINE_INTERVAL_MS is valid (0 = single run, >0 = interval)',
  true
);
check(
  posterInterval === undefined || Number(posterInterval) >= 5000,
  'VITE_BOT_POSTER_INTERVAL_MS is valid (>= 5000ms recommended)',
  true
);

// 3. Code Quality Checks
console.log('\n🔧 Code Quality:');
try {
  // Check if services exist
  const fs = await import('fs');
  const servicesPath = join(__dirname, '..', 'src', 'webapp', 'lib', 'services');
  
  const requiredServices = [
    'botService.ts',
    'botConfig.ts',
    'newsApiService.ts',
    'articleProcessingService.ts',
    'botRoutingService.ts',
    'botPostService.ts',
    'newsPipelineService.ts',
  ];
  
  for (const service of requiredServices) {
    const servicePath = join(servicesPath, service);
    check(
      fs.existsSync(servicePath),
      `Service file exists: ${service}`,
      false
    );
  }
  
  // Check App.tsx initialization
  const appPath = join(__dirname, '..', 'src', 'App.tsx');
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, 'utf-8');
    check(
      appContent.includes('botService.ensureBotProfiles'),
      'App.tsx initializes bot profiles',
      false
    );
    check(
      appContent.includes('botPostService.start'),
      'App.tsx starts bot post service',
      false
    );
    check(
      appContent.includes('newsPipelineService.start'),
      'App.tsx starts news pipeline service',
      false
    );
  }
} catch (error) {
  log(`Error checking code quality: ${error.message}`, 'error');
  checks.failed++;
}

// 4. Production Recommendations
console.log('\n💡 Production Recommendations:');
const recommendations = [];

if (!pipelineInterval || Number(pipelineInterval) === 0) {
  recommendations.push('Set VITE_NEWS_PIPELINE_INTERVAL_MS to a reasonable interval (e.g., 3600000 for 1 hour)');
  log('⚠️  VITE_NEWS_PIPELINE_INTERVAL_MS is 0 (single run mode). Set an interval for continuous operation.', 'warning');
}

if (!posterInterval || Number(posterInterval) < 15000) {
  recommendations.push('Set VITE_BOT_POSTER_INTERVAL_MS to at least 15000ms (15 seconds)');
  log('⚠️  VITE_BOT_POSTER_INTERVAL_MS is too low. Use at least 15000ms to avoid rate limits.', 'warning');
}

if (process.env.VITE_NEWS_API_KEY && !process.env.VITE_NEWS_API_KEY.startsWith('pub_')) {
  recommendations.push('Verify your newsdata.io API key format (should start with "pub_")');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Production Readiness Summary');
console.log('='.repeat(60));
log(`✅ Passed: ${checks.passed}`, 'success');
log(`❌ Failed: ${checks.failed}`, checks.failed > 0 ? 'error' : 'info');
log(`⚠️  Warnings: ${checks.warnings}`, checks.warnings > 0 ? 'warning' : 'info');

if (checks.issues.length > 0) {
  console.log('\n❌ Critical Issues:');
  checks.issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
}

if (recommendations.length > 0) {
  console.log('\n💡 Recommendations:');
  recommendations.forEach((rec, i) => {
    console.log(`   ${i + 1}. ${rec}`);
  });
}

const totalChecks = checks.passed + checks.failed;
const successRate = totalChecks > 0 ? ((checks.passed / totalChecks) * 100).toFixed(1) : 0;

console.log(`\n📈 Success Rate: ${successRate}%`);
console.log('='.repeat(60));

if (checks.failed === 0) {
  log('\n🎉 Feature is ready for production!', 'success');
  process.exit(0);
} else {
  log('\n⚠️  Please fix the critical issues before deploying to production.', 'error');
  process.exit(1);
}

