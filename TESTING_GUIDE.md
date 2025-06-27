# 🧪 Testing Guide for Database & Redis Integration

## Quick Start

**1. Ensure server is running:**
```bash
cd backend && npm run dev
```

**2. Run the test suite:**
```bash
./run_tests.sh
```

## What We Built & Testing

### ✅ **PostgreSQL Database Integration**
- **What**: Migrated from file storage to PostgreSQL with automatic fallback
- **Test**: `./test_database.sh`
- **Verify**: Data persists in database tables, not just files

### ✅ **Redis Session Storage** 
- **What**: Session persistence across server restarts using Redis
- **Test**: `./test_redis.sh`
- **Verify**: Sessions stored in Redis with 7-day TTL

### ✅ **Authentication Flow**
- **What**: Registration, login, and authenticated requests
- **Test**: `./test_auth_flow.sh`
- **Verify**: Users stored in PostgreSQL, sessions in Redis

### ✅ **Graceful Fallback**
- **What**: Automatic degradation when services unavailable
- **Test**: `./test_fallback.sh` (Advanced)
- **Verify**: App continues working with file storage + memory sessions

## Manual Verification Commands

### Check Database Content:
```bash
psql -h localhost -U travel_user -d travel_agent -c "SELECT email, created_at FROM users;"
```

### Check Redis Sessions:
```bash
redis-cli keys "travel-agent:sess:*"
redis-cli get "travel-agent:sess:SESSION_ID"
```

### Check Server Logs:
```bash
tail -f backend/server.log | grep -E "(Storage|Session|Database|Redis)"
```

## Expected Results

### ✅ **Success Indicators:**
- Health endpoint shows `"database": true`
- Server logs show `"Storage adapter initialized with database mode"`  
- Server logs show `"Session store initialized with Redis mode"`
- Sessions persist across server restarts
- User data stored in PostgreSQL tables

### ⚠️ **Fallback Indicators:**
- Server logs show `"file mode (fallback)"` when PostgreSQL unavailable
- Server logs show `"memory mode (fallback)"` when Redis unavailable
- Application continues functioning despite service outages

## Troubleshooting

### Database Issues:
```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql

# Check database connection
psql -h localhost -U travel_user -d travel_agent -c "SELECT 1;"
```

### Redis Issues:
```bash
# Check Redis status  
redis-cli ping

# Restart Redis
brew services restart redis

# Monitor Redis
redis-cli monitor
```

### TypeScript Issues:
```bash
# Run type checking (may show warnings but shouldn't prevent operation)
cd backend && npm run typecheck
```

## Test Results Expected

1. **Infrastructure Check**: Database and Redis both `true`
2. **Auth Flow**: User registration and login successful
3. **Data Persistence**: Users in PostgreSQL, sessions in Redis
4. **Fallback**: Graceful degradation when services unavailable

The system is working correctly if you see both PostgreSQL and Redis modes in the logs! 🎉