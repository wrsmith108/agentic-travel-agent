# Database Setup Guide

The Travel Agent application supports both PostgreSQL and file-based storage. This guide covers setting up PostgreSQL for production use.

## Quick Start (Development)

For development, the application will continue to work with file-based storage if PostgreSQL is not available. To enable database features:

### Option 1: PostgreSQL with Homebrew (macOS)

```bash
# Install PostgreSQL
brew install postgresql
brew services start postgresql

# Create database and user
createdb travel_agent
createuser travel_user -P
# Enter password: dev_password

# Grant permissions
psql -d travel_agent -c "GRANT ALL PRIVILEGES ON DATABASE travel_agent TO travel_user;"
```

### Option 2: PostgreSQL with Docker

```bash
# Start PostgreSQL container
docker run --name travel-agent-postgres \
  -e POSTGRES_DB=travel_agent \
  -e POSTGRES_USER=travel_user \
  -e POSTGRES_PASSWORD=dev_password \
  -p 5432:5432 \
  -d postgres:15

# The database will be available at localhost:5432
```

### Option 3: Use Docker Compose

Create `docker-compose.yml` in the backend directory:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: travel_agent
      POSTGRES_USER: travel_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

Then run:
```bash
docker-compose up -d
```

## Environment Configuration

Update your `.env` file with database credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=travel_agent
DB_USER=travel_user
DB_PASSWORD=dev_password
```

## Running Migrations

Once PostgreSQL is set up:

```bash
# Check migration status
npm run db:status

# Run migrations
npm run db:migrate

# Preview existing file data for migration
npm run db:preview-data

# Backup file data
npm run db:backup-data

# Migrate existing users from files to database
npm run db:migrate-data
```

## Production Setup

### PostgreSQL Production Configuration

For production, consider:

1. **Managed Database Services**:
   - AWS RDS
   - Google Cloud SQL
   - Azure Database for PostgreSQL
   - DigitalOcean Managed Databases

2. **Connection Pooling**:
   - Use pgbouncer or built-in connection pooling
   - Configure appropriate pool sizes

3. **Security**:
   - Enable SSL connections
   - Use strong passwords
   - Limit database access
   - Regular backups

### Environment Variables

```env
# Production Database
DB_HOST=your-production-host
DB_PORT=5432
DB_NAME=travel_agent_prod
DB_USER=travel_user_prod
DB_PASSWORD=secure-production-password
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000

# Redis for Sessions
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=secure-redis-password
```

## Fallback Mode

If PostgreSQL is not available, the application will:

1. **Continue using file-based storage** for users and data
2. **Log warnings** about database unavailability
3. **Disable database-dependent features** like:
   - Advanced search analytics
   - Price history tracking
   - Bulk operations

## Troubleshooting

### Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U travel_user -d travel_agent

# Check if PostgreSQL is running
brew services list | grep postgresql
# or
docker ps | grep postgres
```

### Migration Issues

```bash
# Reset database (development only)
npm run db:reset

# Check logs
tail -f server.log
```

### Performance Issues

```bash
# Monitor database connections
npm run db:status

# Check query performance in logs
# Look for "Slow query" warnings
```

## Migration from File Storage

The migration process:

1. **Backup existing data**: `npm run db:backup-data`
2. **Preview migration**: `npm run db:preview-data`
3. **Run migration**: `npm run db:migrate-data`
4. **Test functionality** with both storage systems
5. **Switch to database mode** in production

## Next Steps

After database setup:

1. ✅ Database schema created
2. ✅ User data migrated
3. 🔄 Set up Redis for sessions
4. 🔄 Implement price monitoring
5. 🔄 Add performance monitoring

---

**Note**: The application is designed to work without a database for development purposes. Database features enhance performance and enable advanced functionality but are not required for basic operation.