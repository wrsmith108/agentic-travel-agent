/**
 * Test script for the new authentication system
 * Run with: npx tsx src/utils/testAuthSystem.ts
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = 'http://localhost:3001/api/v1';
const testEmail = `test-${uuidv4().slice(0, 8)}@example.com`;
const testPassword = 'TestPass123!@#';  // Added special characters

interface AuthResponse {
  success: boolean;
  data?: {
    user: any;
    accessToken: string;
    refreshToken?: string;
    expiresAt: string;
  };
  error?: {
    type: string;
    message: string;
  };
}

let accessToken: string;
let refreshToken: string;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testEndpoint(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ ${name} - PASSED`);
  } catch (error) {
    console.error(`❌ ${name} - FAILED`);
    if (axios.isAxiosError(error)) {
      console.error('   Status:', error.response?.status);
      console.error('   Error:', error.response?.data);
    } else {
      console.error('   Error:', error);
    }
    throw error;
  }
}

async function runTests() {
  console.log('🚀 Starting Authentication System Tests');
  console.log('📧 Test email:', testEmail);
  console.log('🔐 Test password:', testPassword);
  
  try {
    // Test 1: Register a new user
    await testEndpoint('User Registration', async () => {
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/register`, {
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        firstName: 'Test',
        lastName: 'User',
        acceptTerms: true,
        marketingOptIn: false
      });
      
      if (!response.data.success || !response.data.data) {
        throw new Error('Registration failed');
      }
      
      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken || '';
      
      console.log('   User ID:', response.data.data.user.id);
      console.log('   Email:', response.data.data.user.email);
      console.log('   Access Token:', accessToken.substring(0, 20) + '...');
      console.log('   Refresh Token:', refreshToken ? refreshToken.substring(0, 20) + '...' : 'None');
    });

    // Test 2: Try to register with same email (should fail)
    await testEndpoint('Duplicate Registration (Should Fail)', async () => {
      try {
        await axios.post(`${API_BASE_URL}/auth/register`, {
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
          firstName: 'Test',
          lastName: 'User',
          acceptTerms: true,
          marketingOptIn: false
        });
        throw new Error('Expected registration to fail but it succeeded');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          console.log('   Expected error:', error.response.data.error.type);
        } else {
          throw error;
        }
      }
    });

    // Test 3: Login with credentials
    await testEndpoint('User Login', async () => {
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/login`, {
        email: testEmail,
        password: testPassword
      });
      
      if (!response.data.success || !response.data.data) {
        throw new Error('Login failed');
      }
      
      accessToken = response.data.data.accessToken;
      refreshToken = response.data.data.refreshToken || '';
      
      console.log('   Login successful');
      console.log('   New Access Token:', accessToken.substring(0, 20) + '...');
    });

    // Test 4: Login with wrong password (should fail)
    await testEndpoint('Login with Wrong Password (Should Fail)', async () => {
      try {
        await axios.post(`${API_BASE_URL}/auth/login`, {
          email: testEmail,
          password: 'WrongPassword123!'
        });
        throw new Error('Expected login to fail but it succeeded');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          console.log('   Expected error:', error.response.data.error.type);
        } else {
          throw error;
        }
      }
    });

    // Test 5: Access protected endpoint with token
    await testEndpoint('Access Protected Endpoint', async () => {
      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.data.success) {
        throw new Error('Failed to access protected endpoint');
      }
      
      console.log('   User ID:', response.data.data.user.id);
      console.log('   Email:', response.data.data.user.email);
      console.log('   Role:', response.data.data.user.role);
    });

    // Test 6: Access protected endpoint without token (should fail)
    await testEndpoint('Access Protected Endpoint Without Token (Should Fail)', async () => {
      try {
        await axios.get(`${API_BASE_URL}/auth/me`);
        throw new Error('Expected request to fail but it succeeded');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          console.log('   Expected error:', error.response.data.error.type);
        } else {
          throw error;
        }
      }
    });

    // Test 7: Refresh access token
    await testEndpoint('Refresh Access Token', async () => {
      const response = await axios.post<any>(`${API_BASE_URL}/auth/refresh`, {
        refreshToken
      });
      
      if (!response.data.success || !response.data.data) {
        throw new Error('Token refresh failed');
      }
      
      const newAccessToken = response.data.data.accessToken;
      console.log('   New Access Token:', newAccessToken.substring(0, 20) + '...');
      console.log('   Expires At:', response.data.data.expiresAt);
      
      // Update our token
      accessToken = newAccessToken;
    });

    // Test 8: Request password reset
    await testEndpoint('Request Password Reset', async () => {
      const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, {
        email: testEmail
      });
      
      if (!response.data.success) {
        throw new Error('Password reset request failed');
      }
      
      console.log('   Response:', response.data.message);
    });

    // Test 9: Logout
    await testEndpoint('User Logout', async () => {
      const response = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.data.success) {
        throw new Error('Logout failed');
      }
      
      console.log('   Logout successful');
    });

    // Test 10: Try to use token after logout (should fail)
    await testEndpoint('Access After Logout (Should Fail)', async () => {
      try {
        await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        throw new Error('Expected request to fail but it succeeded');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          console.log('   Expected error: Session invalid after logout');
        } else {
          throw error;
        }
      }
    });

    // Test 11: Test validation errors
    await testEndpoint('Registration Validation', async () => {
      try {
        await axios.post(`${API_BASE_URL}/auth/register`, {
          email: 'invalid-email',
          password: 'weak',
          confirmPassword: 'different',
          firstName: '',
          lastName: '',
          acceptTerms: false,
          marketingOptIn: false
        });
        throw new Error('Expected validation to fail but it succeeded');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 400) {
          console.log('   Validation errors detected correctly');
          console.log('   Error details:', JSON.stringify(error.response.data.error.details, null, 2));
        } else {
          throw error;
        }
      }
    });

    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await axios.get(`${API_BASE_URL}`);
    console.log('✅ Server is running');
    console.log('   API Version:', response.data.data.version);
    console.log('   Environment:', response.data.data.environment);
    return true;
  } catch (error) {
    console.error('❌ Server is not running at', API_BASE_URL);
    console.error('   Please start the server with: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔧 Testing Authentication System');
  console.log('================================\n');
  
  // Check if server is running
  if (!await checkServer()) {
    process.exit(1);
  }
  
  // Check if new auth is enabled
  await axios.get(`${API_BASE_URL}`);
  console.log('\n⚠️  Note: Make sure USE_NEW_AUTH=true is set in your .env file\n');
  
  await delay(1000);
  
  // Run tests
  await runTests();
}

main().catch(console.error);