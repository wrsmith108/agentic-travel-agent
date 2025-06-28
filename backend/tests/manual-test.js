#!/usr/bin/env node

/**
 * Manual API Test Script
 * Tests basic functionality of the AI Travel Agent API
 */

const axios = require('axios');
const colors = require('colors');

// API Configuration
const BASE_URL = 'http://localhost:8000/api/v1';
let authCookie = '';

// Test data
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'TestPass123!',
  firstName: 'Test',
  lastName: 'User'
};

// Helper function to make requests
async function apiRequest(method, path, data = null, includeAuth = true) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...(includeAuth && authCookie ? { 'Cookie': authCookie } : {})
      },
      validateStatus: () => true // Don't throw on any status
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    // Extract cookies for auth
    if (response.headers['set-cookie']) {
      authCookie = response.headers['set-cookie'][0].split(';')[0];
    }
    
    return response;
  } catch (error) {
    console.error('Request failed:', error.message);
    return null;
  }
}

// Test functions
async function testHealth() {
  console.log('\n📋 Testing Health Check...');
  const response = await apiRequest('GET', '/../health', null, false);
  
  if (response && response.status === 200) {
    console.log('✅ Health check passed'.green);
    console.log(`   Status: ${response.data.status}`);
  } else {
    console.log('❌ Health check failed'.red);
  }
  
  return response && response.status === 200;
}

async function testRegistration() {
  console.log('\n👤 Testing User Registration...');
  const response = await apiRequest('POST', '/auth/register', testUser, false);
  
  if (response && response.status === 201) {
    console.log('✅ Registration successful'.green);
    console.log(`   User ID: ${response.data.data.user.id}`);
  } else {
    console.log('❌ Registration failed'.red);
    if (response) {
      console.log(`   Error: ${response.data.error?.message || 'Unknown error'}`);
    }
  }
  
  return response && response.status === 201;
}

async function testLogin() {
  console.log('\n🔐 Testing Login...');
  const response = await apiRequest('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password
  }, false);
  
  if (response && response.status === 200) {
    console.log('✅ Login successful'.green);
    console.log(`   Session ID: ${response.data.data.customSessionId}`);
  } else {
    console.log('❌ Login failed'.red);
  }
  
  return response && response.status === 200;
}

async function testPreferences() {
  console.log('\n⚙️  Testing User Preferences...');
  const response = await apiRequest('GET', '/preferences');
  
  if (response && response.status === 200) {
    console.log('✅ Preferences retrieved'.green);
    console.log(`   Email notifications: ${response.data.data.notifications.emailEnabled}`);
    console.log(`   Default cabin class: ${response.data.data.search.defaultCabinClass}`);
  } else {
    console.log('❌ Preferences retrieval failed'.red);
  }
  
  return response && response.status === 200;
}

async function testFlightSearch() {
  console.log('\n✈️  Testing Flight Search...');
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  
  const searchParams = {
    origin: 'JFK',
    destination: 'LAX',
    departureDate: futureDate.toISOString().split('T')[0],
    adults: 1,
    cabinClass: 'ECONOMY'
  };
  
  const response = await apiRequest('POST', '/flights/search', searchParams);
  
  if (response && response.status === 200 && response.data.data.offers) {
    console.log('✅ Flight search successful'.green);
    console.log(`   Found ${response.data.data.offers.length} flights`);
    if (response.data.data.offers[0]) {
      const offer = response.data.data.offers[0];
      console.log(`   Lowest price: ${offer.price.currency} ${offer.price.total}`);
    }
  } else {
    console.log('❌ Flight search failed'.red);
  }
  
  return response && response.status === 200;
}

async function testAIChat() {
  console.log('\n🤖 Testing AI Travel Agent...');
  
  const response = await apiRequest('POST', '/travel-agent/chat', {
    message: 'I need to fly from New York to San Francisco next month'
  });
  
  if (response && response.status === 200 && response.data.data.response) {
    console.log('✅ AI chat successful'.green);
    console.log(`   Response: "${response.data.data.response.substring(0, 100)}..."`);
    console.log(`   Conversation ID: ${response.data.data.conversationId}`);
  } else {
    console.log('❌ AI chat failed'.red);
  }
  
  return response && response.status === 200;
}

async function testSavedSearch() {
  console.log('\n💾 Testing Saved Searches...');
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 45);
  
  const savedSearch = {
    name: 'Test Flight Watch',
    searchParams: {
      origin: 'BOS',
      destination: 'MIA',
      departureDate: futureDate.toISOString().split('T')[0],
      adults: 1,
      cabinClass: 'ECONOMY'
    },
    priceAlerts: {
      enabled: true,
      targetPrice: 500
    }
  };
  
  const response = await apiRequest('POST', '/flights/saved-searches', savedSearch);
  
  if (response && response.status === 201) {
    console.log('✅ Search saved successfully'.green);
    console.log(`   Search ID: ${response.data.data.id}`);
    
    // Try to retrieve saved searches
    const listResponse = await apiRequest('GET', '/flights/saved-searches');
    if (listResponse && listResponse.status === 200) {
      console.log(`   Total saved searches: ${listResponse.data.data.length}`);
    }
  } else {
    console.log('❌ Save search failed'.red);
  }
  
  return response && response.status === 201;
}

// Main test runner
async function runTests() {
  console.log('🧪 AI Travel Agent API Manual Test Suite'.bold);
  console.log('====================================='.bold);
  console.log(`Testing API at: ${BASE_URL}`);
  console.log(`Time: ${new Date().toLocaleString()}\n`);
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  // Run tests in sequence
  const tests = [
    { name: 'Health Check', fn: testHealth },
    { name: 'Registration', fn: testRegistration },
    { name: 'Login', fn: testLogin },
    { name: 'Preferences', fn: testPreferences },
    { name: 'Flight Search', fn: testFlightSearch },
    { name: 'AI Chat', fn: testAIChat },
    { name: 'Saved Search', fn: testSavedSearch }
  ];
  
  for (const test of tests) {
    results.total++;
    try {
      const passed = await test.fn();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} threw error: ${error.message}`.red);
      results.failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY'.bold);
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`.green);
  console.log(`❌ Failed: ${results.failed}`.red);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.passed === results.total) {
    console.log('\n🎉 All tests passed! The API is working correctly.'.green.bold);
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.'.yellow.bold);
  }
}

// Check if server is running
axios.get('http://localhost:8000/health')
  .then(() => {
    console.log('✅ Server is running\n');
    runTests();
  })
  .catch(() => {
    console.log('❌ Server is not running!'.red);
    console.log('Please start the server first with: npm run dev'.yellow);
    process.exit(1);
  });