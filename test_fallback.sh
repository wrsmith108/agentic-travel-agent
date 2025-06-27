#!/bin/bash

echo "⚠️  Testing Service Fallback Behavior"
echo "======================================"

echo "This script tests graceful degradation when services are unavailable"
echo "WARNING: This will temporarily stop Redis and PostgreSQL services"
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Test cancelled."
    exit 0
fi

echo ""
echo "1. Current service status..."
echo "Redis:" $(redis-cli ping 2>/dev/null || echo "Not responding")
echo "PostgreSQL:" $(psql -h localhost -U travel_user -d travel_agent -c "SELECT 1;" 2>/dev/null && echo "Connected" || echo "Not connected")

echo ""
echo "2. Stopping Redis service..."
brew services stop redis
sleep 2

echo "3. Restarting server to test Redis fallback..."
echo "   Check server logs for 'Session store initialized with memory mode (fallback)'"
echo "   Press Enter to continue after checking logs..."
read

echo ""
echo "4. Stopping PostgreSQL service..."
brew services stop postgresql
sleep 2

echo "5. Restarting server to test PostgreSQL fallback..."
echo "   Check server logs for 'Storage adapter initialized with file mode (fallback)'"
echo "   Press Enter to continue after checking logs..."
read

echo ""
echo "6. Restoring services..."
echo "Starting PostgreSQL..."
brew services start postgresql
sleep 3

echo "Starting Redis..."
brew services start redis
sleep 2

echo ""
echo "7. Final verification..."
echo "Redis:" $(redis-cli ping 2>/dev/null || echo "Not responding")
echo "PostgreSQL:" $(psql -h localhost -U travel_user -d travel_agent -c "SELECT 1;" 2>/dev/null && echo "Connected" || echo "Not connected")

echo ""
echo "✅ Fallback testing complete!"
echo "💡 Restart the server once more to verify full functionality is restored"