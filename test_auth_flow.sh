#!/bin/bash

echo "🧪 Testing Authentication Flow"
echo "================================"

# Test User Registration
echo "1. Testing User Registration..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "TestPassword123!"
  }')

echo "Registration Response:"
echo "$REGISTER_RESPONSE" | jq 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

# Extract session cookie if successful
COOKIES=$(curl -s -i -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test2",
    "lastName": "User2", 
    "email": "test2@example.com",
    "password": "TestPassword123!"
  }' | grep -i "set-cookie" | sed 's/Set-Cookie: //' | tr -d '\r\n')

echo "2. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "TestPassword123!"
  }')

echo "Login Response:"
echo "$LOGIN_RESPONSE" | jq 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Extract access token for authenticated requests
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // empty' 2>/dev/null)

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
    echo "3. Testing Authenticated Request..."
    AUTH_RESPONSE=$(curl -s -X GET http://localhost:3001/api/v1/auth/profile \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    echo "Profile Response:"
    echo "$AUTH_RESPONSE" | jq 2>/dev/null || echo "$AUTH_RESPONSE"
    echo ""
else
    echo "❌ Could not extract access token for authenticated test"
fi

echo "✅ Authentication flow test complete!"