#!/bin/bash

echo "=== Fixing all TypeScript errors ==="

# Fix 1: Replace session property access in monitoring routes
echo "Fixing session access in monitoring routes..."
sed -i '' 's/req\.session\.userId/getSessionData(req)?.userId/g' src/routes/monitoring.ts

# Fix 2: Fix createLogger import
echo "Fixing createLogger imports..."
sed -i '' 's/import { createLogger }/import createLogger/g' src/services/ai/travelAgentService.ts
sed -i '' 's/import { createLogger }/import createLogger/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/import { createLogger }/import createLogger/g' src/services/notifications/emailService.ts

# Fix 3: Fix Result type usage with .success/.data
echo "Fixing Result type usage patterns..."

# In travelAgentService.ts
sed -i '' 's/itineraryResult\.success/isOk(itineraryResult)/g' src/services/ai/travelAgentService.ts
sed -i '' 's/itineraryResult\.data/itineraryResult.value/g' src/services/ai/travelAgentService.ts
sed -i '' 's/transportResult\.success/isOk(transportResult)/g' src/services/ai/travelAgentService.ts
sed -i '' 's/transportResult\.data/transportResult.value/g' src/services/ai/travelAgentService.ts
sed -i '' 's/returnTransport\.success/isOk(returnTransport)/g' src/services/ai/travelAgentService.ts
sed -i '' 's/returnTransport\.data/returnTransport.value/g' src/services/ai/travelAgentService.ts
sed -i '' 's/flightResult\.success/isOk(flightResult)/g' src/services/ai/travelAgentService.ts
sed -i '' 's/flightResult\.data/flightResult.value/g' src/services/ai/travelAgentService.ts

# Fix 4: Fix priceMonitoringProcessor Result usage
echo "Fixing Result usage in priceMonitoringProcessor..."
sed -i '' 's/usersResult\.success/isOk(usersResult)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/usersResult\.data/usersResult.value/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/usersResult\.error/usersResult.error/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/keysResult\.success/isOk(keysResult)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/keysResult\.data/keysResult.value/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/searchesResult\.success/isOk(searchesResult)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/searchesResult\.data/searchesResult.value/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/searchesResult\.error/searchesResult.error/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/lastCheckResult\.success/isOk(lastCheckResult)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/lastCheckResult\.data/lastCheckResult.value/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/priceCheckResult\.success/isOk(priceCheckResult)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/priceCheckResult\.data/priceCheckResult.value/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/priceCheckResult\.error/priceCheckResult.error/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/userResult\.success/isOk(userResult)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/userResult\.data/userResult.value/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/result\.value\.success/isOk(result.value)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/result\.value\.data/result.value.value/g' src/services/batch/priceMonitoringProcessor.ts

# Fix 5: Fix validation errors
echo "Fixing validation result usage..."
sed -i '' 's/validation\.success/isOk(validation)/g' src/services/notifications/emailService.ts
sed -i '' 's/validation\.error/validation.error/g' src/services/notifications/emailService.ts
sed -i '' 's/rateLimitCheck\.success/isOk(rateLimitCheck)/g' src/services/notifications/emailService.ts
sed -i '' 's/rateLimitCheck\.error/rateLimitCheck.error/g' src/services/notifications/emailService.ts
sed -i '' 's/result\.value\.success/isOk(result.value)/g' src/services/notifications/emailService.ts
sed -i '' 's/result\.value\.data/result.value.value/g' src/services/notifications/emailService.ts

# Fix 6: Fix redisClient result checks
echo "Fixing Redis client result checks..."
sed -i '' 's/connectResult\.ok/isOk(connectResult)/g' src/services/redis/redisClient.ts
sed -i '' 's/connectResult\.error/connectResult.error/g' src/services/redis/redisClient.ts

# Fix 7: Fix authService issues
echo "Fixing authService issues..."
sed -i '' 's/clearFailedLoginAttempts/cleanupFailedLoginAttempts/g' src/services/auth/authService.ts

echo "=== All fixes applied ==="