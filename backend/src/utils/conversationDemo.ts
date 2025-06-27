/**
 * Simple conversation demo
 * Run with: npx tsx src/utils/conversationDemo.ts
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3001/api/v1';

async function demo() {
  try {
    console.log('🚀 AI Conversation Demo\n');

    // 1. Register a user
    console.log('1️⃣ Creating user account...');
    const email = `traveler-${uuidv4().slice(0, 8)}@example.com`;
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      email,
      password: 'TravelPass123!@#',
      confirmPassword: 'TravelPass123!@#',
      firstName: 'Travel',
      lastName: 'Enthusiast',
      acceptTerms: true,
      marketingOptIn: false,
    });

    const { accessToken } = registerResponse.data.data;
    console.log('✅ User created:', email);

    // 2. Start a conversation
    console.log('\n2️⃣ Starting conversation about Japan trip...');
    const conversationResponse = await axios.post(
      `${API_URL}/conversations`,
      { initialMessage: 'I want to plan a 10-day trip to Japan' },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const conversationId = conversationResponse.data.data.id;
    console.log('✅ Conversation started');

    // 3. Send a message
    console.log('\n3️⃣ Asking for recommendations...');
    const messageResponse = await axios.post(
      `${API_URL}/conversations/${conversationId}/messages`,
      {
        content:
          'I want to visit Tokyo and Kyoto in April. My budget is $3000. What do you recommend?',
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log('✅ AI Response:');
    console.log(messageResponse.data.data.content.substring(0, 300) + '...\n');

    // 4. Update preferences
    console.log('4️⃣ Updating travel preferences...');
    await axios.patch(
      `${API_URL}/conversations/${conversationId}/context`,
      {
        context: {
          preferences: {
            budget: 3000,
            departureAirport: 'JFK',
            destinations: ['Tokyo', 'Kyoto', 'Osaka'],
            travelDates: { start: '2024-04-10', end: '2024-04-20', flexible: true },
            travelers: { adults: 2, children: 0, infants: 0 },
            interests: ['culture', 'food', 'temples', 'cherry blossoms'],
          },
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log('✅ Preferences updated');

    // 5. Ask about flights
    console.log('\n5️⃣ Asking about flight options...');
    const flightResponse = await axios.post(
      `${API_URL}/conversations/${conversationId}/messages`,
      { content: 'What are the best flight options from JFK to Tokyo?' },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log('✅ AI Flight Recommendations:');
    console.log(flightResponse.data.data.content.substring(0, 300) + '...\n');

    console.log('🎉 Demo completed! The AI conversation system is working correctly.');
    console.log('\n📝 Summary:');
    console.log('   - Created user account with authentication');
    console.log('   - Started AI conversation about travel');
    console.log('   - Received personalized recommendations');
    console.log('   - Updated travel preferences');
    console.log('   - Got flight suggestions based on context');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Check server and run demo
async function main() {
  try {
    const response = await axios.get(`${API_URL}`);
    console.log('✅ Server is running');
    console.log('   API Version:', response.data.data.version);
    console.log('   Environment:', response.data.data.environment);
    console.log('\n⚠️  Note: Make sure ANTHROPIC_API_KEY is set in your .env file\n');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await demo();
  } catch (error) {
    console.error('❌ Server is not running at', API_URL);
    console.error('   Please start the server with: npm run dev');
    process.exit(1);
  }
}

main();