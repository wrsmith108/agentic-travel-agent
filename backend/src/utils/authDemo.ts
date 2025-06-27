/**
 * Simple authentication demo
 * Run with: npx tsx src/utils/authDemo.ts
 */

import axios from 'axios';

const API_URL = 'http://localhost:3001/api/v1/auth';

async function demo() {
  try {
    console.log('🚀 Authentication System Demo\n');

    // 1. Register a new user
    console.log('1️⃣ Registering new user...');
    const registerResponse = await axios.post(`${API_URL}/register`, {
      email: 'demo@example.com',
      password: 'DemoPass123!@#',
      confirmPassword: 'DemoPass123!@#',
      firstName: 'Demo',
      lastName: 'User',
      acceptTerms: true,
      marketingOptIn: false
    });

    console.log('✅ Registration successful!');
    console.log('   User ID:', registerResponse.data.data.user.id);
    console.log('   Email:', registerResponse.data.data.user.email);
    console.log('   Access Token:', registerResponse.data.data.accessToken.substring(0, 30) + '...\n');

    const accessToken = registerResponse.data.data.accessToken;

    // 2. Access protected endpoint
    console.log('2️⃣ Accessing protected endpoint...');
    const meResponse = await axios.get(`${API_URL}/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    console.log('✅ Protected endpoint accessed!');
    console.log('   Current user:', meResponse.data.data.user.email);
    console.log('   Role:', meResponse.data.data.user.role + '\n');

    // 3. Login
    console.log('3️⃣ Testing login...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      email: 'demo@example.com',
      password: 'DemoPass123!@#',
      rememberMe: true
    });

    console.log('✅ Login successful!');
    console.log('   New session created');
    console.log('   Remember me: enabled (30-day session)\n');

    // 4. Logout
    console.log('4️⃣ Logging out...');
    await axios.post(`${API_URL}/logout`, {}, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    console.log('✅ Logged out successfully!\n');

    console.log('🎉 Demo completed! The authentication system is working correctly.');
    console.log('\n📝 Summary:');
    console.log('   - User registration with validation');
    console.log('   - JWT-based authentication');
    console.log('   - Protected endpoint access');
    console.log('   - Session management');
    console.log('   - Secure logout');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

demo();