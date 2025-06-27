/**
 * Test script for the conversation API
 * Run with: npx tsx src/utils/testConversationAPI.ts
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = 'http://localhost:3001/api/v1';

interface AuthResponse {
  success: boolean;
  data?: {
    user: any;
    accessToken: string;
    refreshToken?: string;
  };
}

interface ConversationResponse {
  success: boolean;
  data?: {
    id: string;
    title: string;
    messages: any[];
    context: any;
  };
}

interface MessageResponse {
  success: boolean;
  data?: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  };
}

let accessToken: string;
let conversationId: string;

async function authenticate() {
  console.log('🔐 Authenticating...');
  
  // First register/login a test user
  const testEmail = `test-conversation-${uuidv4().slice(0, 8)}@example.com`;
  const testPassword = 'TestPass123!@#';
  
  try {
    // Register
    const registerResponse = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      firstName: 'Test',
      lastName: 'User',
      acceptTerms: true,
      marketingOptIn: false,
    });
    
    if (registerResponse.data.success && registerResponse.data.data) {
      accessToken = registerResponse.data.data.accessToken;
      console.log('✅ Authentication successful');
      console.log('   User:', testEmail);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    return false;
  }
}

async function testConversationAPI() {
  console.log('🤖 Testing Conversation API\n');
  
  // 1. Create a new conversation
  console.log('1️⃣ Creating new conversation...');
  try {
    const createResponse = await axios.post<ConversationResponse>(
      `${API_BASE_URL}/conversations`,
      {
        initialMessage: 'I want to plan a trip to Japan',
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (createResponse.data.success && createResponse.data.data) {
      conversationId = createResponse.data.data.id;
      console.log('✅ Conversation created');
      console.log('   ID:', conversationId);
      console.log('   Title:', createResponse.data.data.title);
    }
  } catch (error: any) {
    console.error('❌ Failed to create conversation:', error.response?.data || error.message);
    return;
  }
  
  // 2. Send a message
  console.log('\n2️⃣ Sending message to conversation...');
  try {
    const messageResponse = await axios.post<MessageResponse>(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        content: 'I want to visit Tokyo and Kyoto in April. What do you recommend?',
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (messageResponse.data.success && messageResponse.data.data) {
      console.log('✅ Message sent and AI responded');
      console.log('   AI Response:', messageResponse.data.data.content.substring(0, 200) + '...');
    }
  } catch (error: any) {
    console.error('❌ Failed to send message:', error.response?.data || error.message);
  }
  
  // 3. Update conversation context
  console.log('\n3️⃣ Updating conversation context...');
  try {
    const contextResponse = await axios.patch(
      `${API_BASE_URL}/conversations/${conversationId}/context`,
      {
        context: {
          preferences: {
            budget: 3000,
            departureAirport: 'JFK',
            destinations: ['Tokyo', 'Kyoto'],
            travelDates: {
              start: '2024-04-10',
              end: '2024-04-20',
              flexible: true,
            },
            travelers: {
              adults: 2,
              children: 0,
              infants: 0,
            },
            interests: ['culture', 'food', 'temples', 'cherry blossoms'],
          },
        },
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (contextResponse.data.success) {
      console.log('✅ Context updated with travel preferences');
    }
  } catch (error: any) {
    console.error('❌ Failed to update context:', error.response?.data || error.message);
  }
  
  // 4. Send another message with context
  console.log('\n4️⃣ Sending contextual message...');
  try {
    const messageResponse = await axios.post<MessageResponse>(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
      {
        content: 'Given my budget and dates, what are the best flight options?',
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (messageResponse.data.success && messageResponse.data.data) {
      console.log('✅ Contextual message sent');
      console.log('   AI Response:', messageResponse.data.data.content.substring(0, 200) + '...');
    }
  } catch (error: any) {
    console.error('❌ Failed to send message:', error.response?.data || error.message);
  }
  
  // 5. Get all conversations
  console.log('\n5️⃣ Getting all conversations...');
  try {
    const listResponse = await axios.get(`${API_BASE_URL}/conversations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (listResponse.data.success) {
      console.log('✅ Retrieved conversations');
      console.log('   Total conversations:', listResponse.data.data.length);
    }
  } catch (error: any) {
    console.error('❌ Failed to get conversations:', error.response?.data || error.message);
  }
  
  // 6. Get specific conversation
  console.log('\n6️⃣ Getting conversation details...');
  try {
    const getResponse = await axios.get(`${API_BASE_URL}/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (getResponse.data.success && getResponse.data.data) {
      console.log('✅ Retrieved conversation');
      console.log('   Messages:', getResponse.data.data.messages.length);
      console.log('   Context:', JSON.stringify(getResponse.data.data.context.preferences, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Failed to get conversation:', error.response?.data || error.message);
  }
  
  // 7. Export conversation
  console.log('\n7️⃣ Exporting conversation...');
  try {
    const exportResponse = await axios.get(
      `${API_BASE_URL}/conversations/${conversationId}/export`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'text',
      }
    );
    
    console.log('✅ Conversation exported');
    console.log('   Preview:', exportResponse.data.substring(0, 100) + '...');
  } catch (error: any) {
    console.error('❌ Failed to export conversation:', error.response?.data || error.message);
  }
  
  console.log('\n✅ Conversation API test completed!');
  console.log('\n📝 Summary:');
  console.log('   - Created and managed conversations');
  console.log('   - Sent messages and received AI responses');
  console.log('   - Updated conversation context with travel preferences');
  console.log('   - Retrieved and exported conversation data');
}

async function main() {
  console.log('🔧 Testing AI Conversation System');
  console.log('=================================\n');
  
  // Check if server is running
  try {
    const response = await axios.get(`${API_BASE_URL}`);
    console.log('✅ Server is running');
    console.log('   Version:', response.data.data.version);
  } catch (error) {
    console.error('❌ Server is not running at', API_BASE_URL);
    console.error('   Please start the server with: npm run dev');
    process.exit(1);
  }
  
  // Authenticate
  if (!(await authenticate())) {
    console.error('❌ Authentication failed, cannot proceed with tests');
    process.exit(1);
  }
  
  // Run tests
  await testConversationAPI();
}

main().catch(console.error);