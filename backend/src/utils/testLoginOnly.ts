#!/usr/bin/env npx tsx
/**
 * Test login with provided credentials
 */

import axios from 'axios';

const API_URL = 'http://localhost:3001/api/v1';

async function testLogin(email: string, password: string) {
  console.log('🔐 Testing Login');
  console.log('=====================================\n');
  console.log(`Email: ${email}`);

  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });

    console.log('\n✅ Login successful!');
    console.log(`   User ID: ${loginResponse.data.data.user.id}`);
    console.log(`   Name: ${loginResponse.data.data.user.firstName} ${loginResponse.data.data.user.lastName}`);
    console.log(`   Access Token: ${loginResponse.data.data.accessToken.substring(0, 20)}...`);

  } catch (error: any) {
    console.error('\n❌ Login failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Get command line arguments
const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: npx tsx testLoginOnly.ts <email> <password>');
  process.exit(1);
}

// Run the test
testLogin(email, password);