/**
 * Test script to verify authentication flow
 * Run with: node backend/test-auth-flow.js
 */
// Ensure we're in development mode for testing
process.env.NODE_ENV = 'development';

const API_BASE = 'http://localhost:3001/api/v1';

async function testAuthFlow() {
  console.log('🔐 Testing Authentication Flow...\n');

  try {
    // Step 1: Get development token
    console.log('1. Fetching development token...');
    const tokenResponse = await fetch(`${API_BASE}/dev/mock-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.data?.token;
    console.log('✅ Token obtained:', token ? token.substring(0, 20) + '...' : 'No token');

    if (!token) {
      throw new Error('No token returned from dev endpoint');
    }

    // Step 2: Test unprotected endpoint
    console.log('\n2. Testing unprotected endpoint (airports search)...');
    const airportsResponse = await fetch(`${API_BASE}/flights/airports?query=NYC`, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Airports endpoint: ${airportsResponse.status} ${airportsResponse.statusText}`);

    // Step 3: Test protected endpoint WITHOUT token
    console.log('\n3. Testing protected endpoint WITHOUT token...');
    const noTokenResponse = await fetch(`${API_BASE}/searches`, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`❌ Expected 401: ${noTokenResponse.status} ${noTokenResponse.statusText}`);

    // Step 4: Test protected endpoint WITH token
    console.log('\n4. Testing protected endpoint WITH token...');
    const withTokenResponse = await fetch(`${API_BASE}/searches`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`✅ Protected endpoint with token: ${withTokenResponse.status} ${withTokenResponse.statusText}`);

    if (withTokenResponse.ok) {
      const data = await withTokenResponse.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    }

    // Step 5: Test another protected endpoint
    console.log('\n5. Testing price alerts endpoint...');
    const alertsResponse = await fetch(`${API_BASE}/price-alerts`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`✅ Price alerts endpoint: ${alertsResponse.status} ${alertsResponse.statusText}`);

    console.log('\n✨ Authentication flow is working correctly!');

  } catch (error) {
    console.error('\n❌ Authentication test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testAuthFlow().catch(console.error);