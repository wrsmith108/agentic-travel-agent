#!/bin/bash

echo "🚀 Agentic Travel Agent - Infrastructure Testing Suite"
echo "====================================================="
echo ""
echo "This test suite verifies:"
echo "✅ PostgreSQL database integration with automatic fallback"
echo "✅ Redis session storage with graceful degradation"  
echo "✅ Authentication flow with persistent sessions"
echo "✅ Service reliability and error handling"
echo ""

# Check if server is running
SERVER_RUNNING=$(curl -s http://localhost:3001/health > /dev/null 2>&1 && echo "true" || echo "false")

if [ "$SERVER_RUNNING" = "false" ]; then
    echo "❌ Server is not running on http://localhost:3001"
    echo "Please start the server first:"
    echo "   cd backend && npm run dev"
    exit 1
fi

echo "✅ Server is running on http://localhost:3001"
echo ""

# Menu for test selection
while true; do
    echo "Select a test to run:"
    echo "1) Basic Infrastructure Check"
    echo "2) Database Integration Test"
    echo "3) Redis Session Test"
    echo "4) Authentication Flow Test" 
    echo "5) Service Fallback Test (Advanced)"
    echo "6) Run All Basic Tests (1-4)"
    echo "7) Exit"
    echo ""
    read -p "Enter your choice (1-7): " choice

    case $choice in
        1)
            echo ""
            echo "🔍 Running Infrastructure Check..."
            echo "================================="
            curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health
            echo ""
            grep -E "(Storage adapter|Session store).*initialized" /Users/williamsmith/Documents/GitHub/agentic-travel-agent/backend/server.log | tail -2
            echo ""
            ;;
        2)
            echo ""
            ./test_database.sh
            echo ""
            ;;
        3)
            echo ""
            ./test_redis.sh
            echo ""
            ;;
        4)
            echo ""
            ./test_auth_flow.sh
            echo ""
            echo "💡 After auth test, check database and Redis:"
            echo "Database: psql -h localhost -U travel_user -d travel_agent -c \"SELECT email, created_at FROM users;\""
            echo "Redis: redis-cli keys 'travel-agent:sess:*'"
            echo ""
            ;;
        5)
            echo ""
            ./test_fallback.sh
            echo ""
            ;;
        6)
            echo ""
            echo "🧪 Running All Basic Tests..."
            echo "============================"
            
            echo "Test 1: Infrastructure Check"
            curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health
            echo ""
            
            echo "Test 2: Database Integration"
            ./test_database.sh
            echo ""
            
            echo "Test 3: Redis Integration" 
            ./test_redis.sh
            echo ""
            
            echo "Test 4: Authentication Flow"
            ./test_auth_flow.sh
            echo ""
            
            echo "🎉 All basic tests completed!"
            echo ""
            ;;
        7)
            echo "Exiting test suite. Happy coding! 🚀"
            exit 0
            ;;
        *)
            echo "Invalid choice. Please enter 1-7."
            ;;
    esac
    
    read -p "Press Enter to continue..."
    echo ""
done