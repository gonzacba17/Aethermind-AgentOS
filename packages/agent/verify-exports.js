/**
 * Test script to validate @aethermind/agent exports
 * Run with: node verify-exports.js
 */

console.log('🧪 Testing @aethermind/agent exports...\n');

// Test CommonJS require
const pkg = require('./dist/index.js');

console.log('📦 Exported keys:', Object.keys(pkg));
console.log('🔢 VERSION:', pkg.VERSION);
console.log('');

// Validate exports
const requiredExports = ['initAethermind', 'VERSION'];
const hasAllExports = requiredExports.every(key => key in pkg);

if (!hasAllExports) {
  console.error('❌ Missing required exports!');
  console.error('   Expected:', requiredExports);
  console.error('   Got:', Object.keys(pkg));
  process.exit(1);
}

console.log('✅ All required exports present');

// Validate VERSION format
if (!/^\d+\.\d+\.\d+$/.test(pkg.VERSION)) {
  console.error('❌ Invalid VERSION format:', pkg.VERSION);
  console.error('   Expected: X.Y.Z (e.g., 0.1.1)');
  process.exit(1);
}

console.log('✅ VERSION format valid:', pkg.VERSION);

// Validate initAethermind is a function
if (typeof pkg.initAethermind !== 'function') {
  console.error('❌ initAethermind is not a function!');
  process.exit(1);
}

console.log('✅ initAethermind is a function');

// Test that initAethermind can be called (dry-run without real API key)
try {
  // This should throw validation error for missing apiKey, which is expected
  pkg.initAethermind({});
} catch (error) {
  if (error.message.includes('API key')) {
    console.log('✅ initAethermind validation working correctly');
  } else {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

console.log('\n🎉 All export tests passed!');
console.log('\n📋 Summary:');
console.log('   - Exports: initAethermind, VERSION');
console.log('   - Version:', pkg.VERSION);
console.log('   - Ready for npm publish ✅');
