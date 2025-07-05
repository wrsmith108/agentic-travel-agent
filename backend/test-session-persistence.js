/**
 * Test script to verify session persistence
 * Run with: node backend/test-session-persistence.js
 */

// Ensure we're in development mode for testing
process.env.NODE_ENV = 'development';

const API_BASE = 'http://localhost:3001/api/v1';

async function testSessionPersistence() {
  console.log('🔐 Testing Session Persistence...\n');

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
    const sessionId = tokenData.data?.sessionId;
    console.log('✅ Token obtained:', token ? token.substring(0, 20) + '...' : 'No token');
    console.log('✅ Session ID:', sessionId || 'No session ID');

    // Step 2: Make multiple requests with same token
    console.log('\n2. Testing multiple requests with same token...');
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Request 1
    const req1 = await fetch(`${API_BASE}/searches`, { headers });
    console.log(`Request 1: ${req1.status} ${req1.statusText}`);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Request 2
    const req2 = await fetch(`${API_BASE}/searches`, { headers });
    console.log(`Request 2: ${req2.status} ${req2.statusText}`);
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Request 3
    const req3 = await fetch(`${API_BASE}/price-alerts`, { headers });
    console.log(`Request 3: ${req3.status} ${req3.statusText}`);

    // Step 3: Check if all requests succeeded
    if (req1.ok && req2.ok && req3.ok) {
      console.log('\n✅ Session persistence is working! Same token works across multiple requests.');
    } else {
      console.log('\n❌ Session persistence issue detected!');
    }

    // Step 4: Test session info endpoint (if exists)
    console.log('\n3. Checking session info...');
    const sessionResponse = await fetch(`${API_BASE}/auth/session`, { headers });
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      console.log('Session data:', JSON.stringify(sessionData, null, 2));
    } else {
      console.log('No session info endpoint available (this is normal)');
    }

  } catch (error) {
    console.error('\n❌ Session persistence test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testSessionPersistence()
  .then(() => {
    console.log('\n✨ Session persistence test completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });