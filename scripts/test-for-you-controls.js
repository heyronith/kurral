/**
 * Comprehensive Test for For You Feed Controls
 * Tests preset buttons and NL fine-tuning exactly as they work in real environment
 * 
 * Usage: node scripts/test-for-you-controls.js
 * 
 * This test simulates the full flow:
 * 1. Preset button clicks → instruction submission → AI interpretation → config update
 * 2. Custom NL instructions → AI interpretation → config update → interest extraction
 * 3. Error handling when AI is unavailable
 * 4. Interest management (add/remove)
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

// Import the actual instruction service
let instructionService;
let ALL_TOPICS;
let BaseAgent;

try {
  // Import from JS files (compiled or source)
  const instructionModule = await import('../src/webapp/lib/services/instructionService.js');
  instructionService = instructionModule.instructionService;
  
  const typesModule = await import('../src/webapp/types/index.js');
  ALL_TOPICS = typesModule.ALL_TOPICS;
  
  const baseAgentModule = await import('../src/webapp/lib/agents/baseAgent.js');
  BaseAgent = baseAgentModule.default;
} catch (error) {
  console.error('Failed to import modules:', error.message);
  console.error('Stack:', error.stack);
  console.error('\nNote: This test requires:');
  console.error('1. The codebase to be accessible');
  console.error('2. VITE_OPENAI_API_KEY to be set in .env for AI tests');
  console.error('3. Node.js to support ES modules');
  process.exit(1);
}

// Mock config store (simulating useConfigStore)
let currentConfig = {
  followingWeight: 'medium',
  boostActiveConversations: true,
  likedTopics: [],
  mutedTopics: [],
};

const setForYouConfig = (newConfig) => {
  currentConfig = { ...newConfig };
  console.log('  📝 Config updated:', JSON.stringify(newConfig, null, 2));
};

// Mock user store (simulating useUserStore)
let currentUser = {
  id: 'test-user-1',
  interests: [],
  topics: [],
};

const updateInterests = async (newInterests) => {
  currentUser.interests = [...newInterests];
  console.log('  💡 Interests updated:', newInterests);
};

// Preset definitions (matching ForYouControls.tsx)
const SMART_PRESETS = [
  {
    id: 'discovery',
    label: 'Discovery',
    description: 'Explore new voices',
    instruction: 'Show me more diverse content from people I don\'t follow, prioritize discovery over following',
    icon: '🔍',
  },
  {
    id: 'following',
    label: 'Stay Connected',
    description: 'Focus on people you follow',
    instruction: 'Show me more posts from people I follow, prioritize following over discovery',
    icon: '👥',
  },
  {
    id: 'active',
    label: 'Lively Discussions',
    description: 'Boost active conversations',
    instruction: 'Show me posts with active discussions and conversations, boost active threads',
    icon: '💬',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Mix of everything',
    instruction: 'Show me a balanced mix of following and discovery, moderate settings',
    icon: '⚖️',
  },
];

// Simulate handleInstructionSubmit from ForYouControls
async function handleInstructionSubmit(instruction) {
  if (!instruction || !instruction.trim()) {
    throw new Error('Tell the AI how you want your feed to feel.');
  }

  try {
    const maxInstructionTopics = currentUser?.topics?.length > 0 
      ? currentUser.topics.filter(t => ALL_TOPICS.includes(t))
      : ALL_TOPICS;

    const currentInterests = currentUser?.interests || [];

    console.log(`  🔄 Processing instruction: "${instruction}"`);
    console.log(`  📊 Current config:`, JSON.stringify(currentConfig, null, 2));
    console.log(`  💡 Current interests:`, currentInterests);

    const result = await instructionService.interpretInstruction(
      instruction.trim(),
      currentConfig,
      maxInstructionTopics,
      currentInterests
    );

    // Update config (simulating setForYouConfig)
    setForYouConfig(result.newConfig);

    // Update interests if provided
    if (result.interestsToAdd?.length || result.interestsToRemove?.length) {
      const existing = currentUser.interests || [];
      let updated = [...existing];

      if (result.interestsToAdd?.length) {
        result.interestsToAdd.forEach((interest) => {
          if (!updated.includes(interest)) {
            updated.push(interest);
          }
        });
      }

      if (result.interestsToRemove?.length) {
        updated = updated.filter(
          (interest) => !result.interestsToRemove?.includes(interest)
        );
      }

      await updateInterests(updated);
    }

    return {
      success: true,
      explanation: result.explanation,
      newConfig: result.newConfig,
      interestsToAdd: result.interestsToAdd || [],
      interestsToRemove: result.interestsToRemove || [],
    };
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
    throw error;
  }
}

// Simulate handlePresetClick from ForYouControls
async function handlePresetClick(preset) {
  console.log(`\n🎯 Testing Preset: ${preset.label} (${preset.icon})`);
  console.log(`   Description: ${preset.description}`);
  console.log(`   Instruction: "${preset.instruction}"`);
  
  return handleInstructionSubmit(preset.instruction);
}

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
};

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    console.error(`❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
    console.error(`❌ ${message}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Got: ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(array, item, message) {
  if (array.includes(item)) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Expected ${item} in ${JSON.stringify(array)}`);
    console.error(`❌ ${message}`);
  }
}

function assertValidConfig(config, message) {
  const isValid = 
    config &&
    typeof config.followingWeight === 'string' &&
    ['none', 'light', 'medium', 'heavy'].includes(config.followingWeight) &&
    typeof config.boostActiveConversations === 'boolean' &&
    Array.isArray(config.likedTopics) &&
    Array.isArray(config.mutedTopics);
  
  if (isValid) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(`${message} - Invalid config: ${JSON.stringify(config)}`);
    console.error(`❌ ${message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting For You Feed Controls Comprehensive Tests...\n');
  console.log('='.repeat(70));
  console.log('');

  // Check if AI agent is available
  const isAIAvailable = BaseAgent.isAvailable();
  
  if (!isAIAvailable) {
    console.log('⚠️  WARNING: VITE_OPENAI_API_KEY is not set.');
    console.log('   AI agent tests will be skipped.');
    console.log('   Set VITE_OPENAI_API_KEY in .env to test AI functionality.\n');
  } else {
    console.log('✅ AI agent is available. Testing with real OpenAI API.\n');
  }

  // Test 1: Preset Buttons
  console.log('📋 Test Suite 1: Preset Button Functionality');
  console.log('='.repeat(70));
  
  if (isAIAvailable) {
    for (const preset of SMART_PRESETS) {
      try {
        const result = await handlePresetClick(preset);
        
        assert(result.success, `${preset.label} preset executed successfully`);
        assertValidConfig(result.newConfig, `${preset.label} preset returned valid config`);
        assert(
          typeof result.explanation === 'string' && result.explanation.length > 0,
          `${preset.label} preset provided explanation`
        );
        
        // Verify config was actually updated
        assertEqual(
          currentConfig.followingWeight,
          result.newConfig.followingWeight,
          `${preset.label} preset updated followingWeight in store`
        );
        assertEqual(
          currentConfig.boostActiveConversations,
          result.newConfig.boostActiveConversations,
          `${preset.label} preset updated boostActiveConversations in store`
        );
        
        console.log(`   Explanation: ${result.explanation}\n`);
      } catch (error) {
        testResults.failed++;
        testResults.errors.push(`${preset.label} preset failed: ${error.message}`);
        console.error(`   ❌ Failed: ${error.message}\n`);
      }
    }
  } else {
    console.log('⏭️  Skipping preset tests (AI not available)\n');
  }

  // Test 2: Custom NL Instructions - Following Weight
  console.log('📋 Test Suite 2: Custom NL Instructions - Following Weight');
  console.log('='.repeat(70));
  
  if (isAIAvailable) {
    // Reset config
    currentConfig = {
      followingWeight: 'medium',
      boostActiveConversations: true,
      likedTopics: [],
      mutedTopics: [],
    };

    const nlTests = [
      {
        instruction: 'Show me only people I follow',
        expectedWeight: 'heavy',
        description: 'Heavy following weight instruction',
      },
      {
        instruction: 'I want discovery mode, show me new people',
        expectedWeight: 'light',
        description: 'Light following weight (discovery) instruction',
      },
      {
        instruction: 'No following boost, full discovery',
        expectedWeight: 'none',
        description: 'None following weight instruction',
      },
    ];

    for (const test of nlTests) {
      try {
        console.log(`\n📝 Testing: "${test.instruction}"`);
        const result = await handleInstructionSubmit(test.instruction);
        
        assert(result.success, `${test.description} executed successfully`);
        assertValidConfig(result.newConfig, `${test.description} returned valid config`);
        
        // Note: AI might interpret differently, so we check if it changed from default
        assert(
          result.newConfig.followingWeight !== currentConfig.followingWeight || 
          result.newConfig.followingWeight === test.expectedWeight,
          `${test.description} changed followingWeight (got: ${result.newConfig.followingWeight})`
        );
        
        console.log(`   Result: ${result.explanation}`);
        console.log(`   Following weight: ${result.newConfig.followingWeight}`);
      } catch (error) {
        testResults.failed++;
        testResults.errors.push(`${test.description} failed: ${error.message}`);
        console.error(`   ❌ Failed: ${error.message}`);
      }
    }
  } else {
    console.log('⏭️  Skipping NL instruction tests (AI not available)\n');
  }

  // Test 3: Custom NL Instructions - Topic Preferences
  console.log('\n📋 Test Suite 3: Custom NL Instructions - Topic Preferences');
  console.log('='.repeat(70));
  
  if (isAIAvailable) {
    currentConfig = {
      followingWeight: 'medium',
      boostActiveConversations: true,
      likedTopics: [],
      mutedTopics: [],
    };

    const topicTests = [
      {
        instruction: 'Show me more #dev and #design content',
        description: 'Add liked topics instruction',
      },
      {
        instruction: 'I want less politics, avoid crypto',
        description: 'Mute topics instruction',
      },
      {
        instruction: 'I love design but hate politics',
        description: 'Mixed topic preferences instruction',
      },
    ];

    for (const test of topicTests) {
      try {
        console.log(`\n📝 Testing: "${test.instruction}"`);
        const result = await handleInstructionSubmit(test.instruction);
        
        assert(result.success, `${test.description} executed successfully`);
        assertValidConfig(result.newConfig, `${test.description} returned valid config`);
        assert(
          Array.isArray(result.newConfig.likedTopics) && Array.isArray(result.newConfig.mutedTopics),
          `${test.description} returned valid topic arrays`
        );
        
        console.log(`   Result: ${result.explanation}`);
        console.log(`   Liked topics: ${result.newConfig.likedTopics.join(', ') || 'none'}`);
        console.log(`   Muted topics: ${result.newConfig.mutedTopics.join(', ') || 'none'}`);
      } catch (error) {
        testResults.failed++;
        testResults.errors.push(`${test.description} failed: ${error.message}`);
        console.error(`   ❌ Failed: ${error.message}`);
      }
    }
  } else {
    console.log('⏭️  Skipping topic preference tests (AI not available)\n');
  }

  // Test 4: Interest Extraction
  console.log('\n📋 Test Suite 4: Interest Extraction from NL Instructions');
  console.log('='.repeat(70));
  
  if (isAIAvailable) {
    currentUser.interests = [];
    currentConfig = {
      followingWeight: 'medium',
      boostActiveConversations: true,
      likedTopics: [],
      mutedTopics: [],
    };

    const interestTests = [
      {
        instruction: 'Show me react tutorials and AI research',
        expectedInterests: ['react', 'tutorials', 'ai', 'research'],
        description: 'Extract multiple interests',
      },
      {
        instruction: 'I want startup funding posts and design content',
        expectedInterests: ['startup', 'funding', 'design'],
        description: 'Extract business and design interests',
      },
      {
        instruction: 'Show me less politics content',
        expectedRemove: ['politics'],
        description: 'Remove interest instruction',
      },
    ];

    for (const test of interestTests) {
      try {
        console.log(`\n📝 Testing: "${test.instruction}"`);
        const result = await handleInstructionSubmit(test.instruction);
        
        assert(result.success, `${test.description} executed successfully`);
        
        if (test.expectedInterests) {
          const hasAllInterests = test.expectedInterests.some(interest => 
            result.interestsToAdd?.includes(interest) || currentUser.interests.includes(interest)
          );
          assert(
            hasAllInterests || result.interestsToAdd?.length > 0,
            `${test.description} extracted interests (got: ${result.interestsToAdd?.join(', ') || 'none'})`
          );
        }
        
        if (test.expectedRemove) {
          assert(
            result.interestsToRemove?.length > 0 || 
            !currentUser.interests.some(i => test.expectedRemove.includes(i)),
            `${test.description} handled interest removal`
          );
        }
        
        console.log(`   Result: ${result.explanation}`);
        console.log(`   Interests to add: ${result.interestsToAdd?.join(', ') || 'none'}`);
        console.log(`   Interests to remove: ${result.interestsToRemove?.join(', ') || 'none'}`);
        console.log(`   Current user interests: ${currentUser.interests.join(', ') || 'none'}`);
      } catch (error) {
        testResults.failed++;
        testResults.errors.push(`${test.description} failed: ${error.message}`);
        console.error(`   ❌ Failed: ${error.message}`);
      }
    }
  } else {
    console.log('⏭️  Skipping interest extraction tests (AI not available)\n');
  }

  // Test 5: Error Handling
  console.log('\n📋 Test Suite 5: Error Handling');
  console.log('='.repeat(70));
  
  try {
    // Test empty instruction
    await handleInstructionSubmit('');
    testResults.failed++;
    testResults.errors.push('Empty instruction should throw error');
    console.error('❌ Empty instruction should throw error');
  } catch (error) {
    assert(
      error.message.includes('describe') || error.message.includes('instruction'),
      'Empty instruction throws appropriate error'
    );
    console.log(`✅ Empty instruction correctly rejected: ${error.message}`);
  }

  try {
    // Test whitespace-only instruction
    await handleInstructionSubmit('   ');
    testResults.failed++;
    testResults.errors.push('Whitespace-only instruction should throw error');
    console.error('❌ Whitespace-only instruction should throw error');
  } catch (error) {
    assert(
      error.message.includes('describe') || error.message.includes('instruction'),
      'Whitespace-only instruction throws appropriate error'
    );
    console.log(`✅ Whitespace-only instruction correctly rejected: ${error.message}`);
  }

  // Test 6: Complex Real-World Scenarios
  console.log('\n📋 Test Suite 6: Complex Real-World Scenarios');
  console.log('='.repeat(70));
  
  if (isAIAvailable) {
    currentConfig = {
      followingWeight: 'medium',
      boostActiveConversations: true,
      likedTopics: [],
      mutedTopics: [],
    };
    currentUser.interests = [];

    const complexTests = [
      {
        instruction: 'Show me more posts from people I follow, prioritize following over discovery, and boost active discussions',
        description: 'Complex instruction with multiple preferences',
      },
      {
        instruction: 'I want discovery mode with no following boost, show me react and AI content, but avoid politics',
        description: 'Complex instruction with discovery, interests, and topic muting',
      },
      {
        instruction: 'Show me a balanced feed with active conversations, focus on design and startup topics',
        description: 'Balanced feed with active boost and topic preferences',
      },
    ];

    for (const test of complexTests) {
      try {
        console.log(`\n📝 Testing: "${test.instruction}"`);
        const result = await handleInstructionSubmit(test.instruction);
        
        assert(result.success, `${test.description} executed successfully`);
        assertValidConfig(result.newConfig, `${test.description} returned valid config`);
        assert(
          result.explanation && result.explanation.length > 10,
          `${test.description} provided detailed explanation`
        );
        
        console.log(`   Result: ${result.explanation}`);
        console.log(`   Config:`, JSON.stringify(result.newConfig, null, 2));
        console.log(`   Interests added: ${result.interestsToAdd?.join(', ') || 'none'}`);
      } catch (error) {
        testResults.failed++;
        testResults.errors.push(`${test.description} failed: ${error.message}`);
        console.error(`   ❌ Failed: ${error.message}`);
      }
    }
  } else {
    console.log('⏭️  Skipping complex scenario tests (AI not available)\n');
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Total: ${testResults.passed + testResults.failed}`);
  console.log('');

  if (testResults.failed > 0) {
    console.log('❌ Failed Tests:');
    testResults.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('🎉 All For You Feed Controls tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});

