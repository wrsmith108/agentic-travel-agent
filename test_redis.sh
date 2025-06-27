#!/bin/bash

echo "🔴 Testing Redis Integration" 
echo "============================="

echo "1. Checking Redis connection..."
redis-cli ping && echo "✅ Redis connection successful" || echo "❌ Redis connection failed"

echo ""
echo "2. Checking Redis info..."
redis-cli info server | grep "redis_version"
redis-cli info memory | grep "used_memory_human"

echo ""
echo "3. Checking session storage mode from server logs..."
grep -i "session.*initialized" /Users/williamsmith/Documents/GitHub/agentic-travel-agent/backend/server.log | tail -1

echo ""
echo "4. Current Redis keys (sessions will appear after auth tests)..."
redis-cli keys "*"

echo ""
echo "5. Session store capabilities from logs..."
grep -A 10 "Session store capabilities" /Users/williamsmith/Documents/GitHub/agentic-travel-agent/backend/server.log | tail -10

echo ""
echo "✅ Redis verification complete!"
echo ""
echo "💡 After running auth tests, check for session keys with:"
echo "   redis-cli keys 'travel-agent:sess:*'"