#!/usr/bin/env npx tsx
/**
 * Test password persistence across server restarts
 */

import axios from 'axios';

const API_URL = 'http://localhost:3001/api/v1';

// Generate unique email for this test
const testEmail = `persist-test-${Date.now()}@example.com`;
const testPassword = 'TestPass123!@#';

async function testPasswordPersistence() {
  console.log('🔐 Testing Password Persistence');
  console.log('=====================================\n');

  try {
    // 1. Register a new user
    console.log('1️⃣ Registering new user...');
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      firstName: 'Password',
      lastName: 'Test',
      acceptTerms: true,
      marketingOptIn: false,
    });

    console.log('✅ Registration successful!');
    console.log(`   Email: ${testEmail}`);
    console.log(`   User ID: ${registerResponse.data.data.user.id}`);
    
    // Store tokens for later use
    const { accessToken } = registerResponse.data.data;

    // 2. Test immediate login (should work)
    console.log('\n2️⃣ Testing immediate login...');
    await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword,
    });

    console.log('✅ Immediate login successful!');

    // 3. Get user info with token
    console.log('\n3️⃣ Verifying authentication...');
    const meResponse = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log('✅ Authentication verified!');
    console.log(`   User: ${meResponse.data.data.user.firstName} ${meResponse.data.data.user.lastName}`);

    // 4. Instructions for manual testing
    console.log('\n' + '='.repeat(50));
    console.log('📋 MANUAL TEST INSTRUCTIONS:');
    console.log('='.repeat(50));
    console.log('\n1. Stop the server (Ctrl+C)');
    console.log('2. Start the server again: npm run dev');
    console.log('3. Run this command to test login after restart:\n');
    console.log(`   curl -X POST ${API_URL}/auth/login \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log(`     -d '{"email": "${testEmail}", "password": "${testPassword}"}'`);
    console.log('\n4. Or use this test command:\n');
    console.log(`   npx tsx src/utils/testLoginOnly.ts "${testEmail}" "${testPassword}"`);
    console.log('\n' + '='.repeat(50));

  } catch (error: any) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run the test
testPasswordPersistence();