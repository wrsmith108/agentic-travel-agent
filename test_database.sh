#!/bin/bash

echo "🗄️  Testing Database Integration"
echo "==============================="

echo "1. Checking PostgreSQL connection..."
psql -h localhost -U travel_user -d travel_agent -c "SELECT NOW() as current_time;" 2>/dev/null && echo "✅ PostgreSQL connection successful" || echo "❌ PostgreSQL connection failed"

echo ""
echo "2. Checking database tables..."
psql -h localhost -U travel_user -d travel_agent -c "\dt" 2>/dev/null

echo ""
echo "3. Checking schema migration status..."
psql -h localhost -U travel_user -d travel_agent -c "SELECT * FROM migrations ORDER BY executed_at DESC LIMIT 5;" 2>/dev/null

echo ""
echo "4. Checking user storage mode from server logs..."
grep -i "storage.*initialized" /Users/williamsmith/Documents/GitHub/agentic-travel-agent/backend/server.log | tail -1

echo ""
echo "5. After running auth tests, check user data..."
echo "   Run: psql -h localhost -U travel_user -d travel_agent -c \"SELECT id, email, created_at FROM users;\""

echo ""
echo "✅ Database verification complete!"