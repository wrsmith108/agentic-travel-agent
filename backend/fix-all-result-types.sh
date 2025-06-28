#!/bin/bash

echo "Fixing all remaining Result type issues..."

# Fix routes/monitoring.ts session access
sed -i '' 's/!req\.session || !req\.session\./!getSessionData(req) || !getSessionData(req)\./g' src/routes/monitoring.ts

# Fix routes/monitoring.ts Result usage
sed -i '' 's/stats\.success/isOk(stats)/g' src/routes/monitoring.ts
sed -i '' 's/stats\.data/stats.value/g' src/routes/monitoring.ts

# Fix conversational search service
sed -i '' 's/!searchResult\.success/!isOk(searchResult)/g' src/services/ai/conversationalSearchService.ts
sed -i '' 's/searchResult\.success/isOk(searchResult)/g' src/services/ai/conversationalSearchService.ts
sed -i '' 's/searchResult\.data/searchResult.value/g' src/services/ai/conversationalSearchService.ts
sed -i '' 's/result\.success/isOk(result)/g' src/services/ai/conversationalSearchService.ts
sed -i '' 's/result\.data/result.value/g' src/services/ai/conversationalSearchService.ts

# Add isOk imports where missing
if ! grep -q "import.*isOk.*from.*result" src/services/ai/conversationalSearchService.ts; then
  sed -i '' '/import.*Result.*from.*result/s/$/\nimport { isOk, isErr } from '\''..\/..\/utils\/result'\'';/' src/services/ai/conversationalSearchService.ts
fi

# Fix travel agent service
sed -i '' 's/flightSearch\.success/isOk(flightSearch)/g' src/services/ai/travelAgentService.ts  
sed -i '' 's/flightSearch\.data/flightSearch.value/g' src/services/ai/travelAgentService.ts
sed -i '' 's/result\.success/isOk(result)/g' src/services/ai/travelAgentService.ts
sed -i '' 's/result\.data/result.value/g' src/services/ai/travelAgentService.ts

# Add isOk imports to travel agent service
if ! grep -q "import.*isOk.*from.*result" src/services/ai/travelAgentService.ts; then
  sed -i '' '/import.*Result.*from.*result/s/$/\nimport { isOk, isErr } from '\''..\/..\/utils\/result'\'';/' src/services/ai/travelAgentService.ts
fi

# Fix enhanced amadeus service
sed -i '' 's/result\.success/result.ok/g' src/services/flights/enhancedAmadeusService.ts
sed -i '' 's/result\.data/result.value/g' src/services/flights/enhancedAmadeusService.ts
sed -i '' 's/existingResult\.success/existingResult.ok/g' src/services/flights/enhancedAmadeusService.ts
sed -i '' 's/existingResult\.data/existingResult.value/g' src/services/flights/enhancedAmadeusService.ts
sed -i '' 's/setResult\.success/setResult.ok/g' src/services/flights/enhancedAmadeusService.ts

# Fix flight search service  
sed -i '' 's/!result\.success/!isOk(result)/g' src/services/flights/flightSearchService.ts
sed -i '' 's/result\.success/isOk(result)/g' src/services/flights/flightSearchService.ts
sed -i '' 's/result\.data/result.value/g' src/services/flights/flightSearchService.ts
sed -i '' 's/searchResult\.success/isOk(searchResult)/g' src/services/flights/flightSearchService.ts
sed -i '' 's/searchResult\.data/searchResult.value/g' src/services/flights/flightSearchService.ts

# Add isOk imports to flight search service
if ! grep -q "import.*isOk.*from.*result" src/services/flights/flightSearchService.ts; then
  sed -i '' '/import.*Result.*from.*result/s/$/\nimport { isOk, isErr } from '\''..\/..\/utils\/result'\'';/' src/services/flights/flightSearchService.ts
fi

# Fix email service
sed -i '' 's/!result\.success/!isOk(result)/g' src/services/notifications/emailService.ts
sed -i '' 's/result\.success/isOk(result)/g' src/services/notifications/emailService.ts
sed -i '' 's/result\.data/result.value/g' src/services/notifications/emailService.ts

# Add isOk imports to email service
if ! grep -q "import.*isOk.*from.*result" src/services/notifications/emailService.ts; then
  sed -i '' '/import.*Result.*from.*result/s/$/\nimport { isOk, isErr } from '\''..\/..\/utils\/result'\'';/' src/services/notifications/emailService.ts
fi

# Fix batch processor
sed -i '' 's/!result\.success/!isOk(result)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/result\.success/isOk(result)/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/result\.data/result.value/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/existingResult\.success/existingResult.ok/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/existingResult\.data/existingResult.value/g' src/services/batch/priceMonitoringProcessor.ts

# Add isOk imports to batch processor
if ! grep -q "import.*isOk.*from.*result" src/services/batch/priceMonitoringProcessor.ts; then
  sed -i '' '/import.*Result.*from.*result/s/$/\nimport { isOk, isErr } from '\''..\/..\/utils\/result'\'';/' src/services/batch/priceMonitoringProcessor.ts
fi

# Fix metrics service
sed -i '' 's/!result\.success/!result.ok/g' src/services/monitoring/metricsService.ts
sed -i '' 's/result\.success/result.ok/g' src/services/monitoring/metricsService.ts
sed -i '' 's/result\.data/result.value/g' src/services/monitoring/metricsService.ts

# Fix error tracker
sed -i '' 's/!result\.success/!result.ok/g' src/services/monitoring/errorTracker.ts
sed -i '' 's/result\.success/result.ok/g' src/services/monitoring/errorTracker.ts
sed -i '' 's/result\.data/result.value/g' src/services/monitoring/errorTracker.ts

# Fix performance monitor
sed -i '' 's/!result\.success/!result.ok/g' src/services/monitoring/performanceMonitor.ts
sed -i '' 's/result\.success/result.ok/g' src/services/monitoring/performanceMonitor.ts
sed -i '' 's/result\.data/result.value/g' src/services/monitoring/performanceMonitor.ts

# Fix redis client
sed -i '' 's/!connectResult\.success/!connectResult.ok/g' src/services/redis/redisClient.ts
sed -i '' 's/connectResult\.success/connectResult.ok/g' src/services/redis/redisClient.ts
sed -i '' 's/setResult\.success/setResult.ok/g' src/services/redis/redisClient.ts
sed -i '' 's/result\.error/result.error/g' src/services/redis/redisClient.ts

# Fix session store - remaining issues
sed -i '' 's/cleanupResult\.error/cleanupResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/setResult\.error/setResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/userSessionsResult\.error/userSessionsResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/getResult\.error/getResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/updateResult\.error/updateResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/existsResult\.error/existsResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/sessionResult\.error/sessionResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/sessionIdsResult\.error/sessionIdsResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/delResult\.error/delResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/existingResult\.error/existingResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/sessionsResult\.error/sessionsResult.error/g' src/services/redis/sessionStore.ts
sed -i '' 's/keysResult\.error/keysResult.error/g' src/services/redis/sessionStore.ts

# Fix JWT
sed -i '' 's/accessResult\.error/accessResult.error/g' src/utils/jwt.ts
sed -i '' 's/refreshResult\.error/refreshResult.error/g' src/utils/jwt.ts
sed -i '' 's/decoded\.error/decoded.error/g' src/utils/jwt.ts

echo "Fixing TripPlanRequest type issues..."

# Fix TripPlanRequest duration field in routes
sed -i '' '/duration:.*z\.object/,/})\.optional()/{s/days: z\.number()/days: z.number().optional()/}' src/routes/travelAgent.ts

# Fix traveler profile required fields
sed -i '' '/profile:.*z\.object/,/}),/{
  s/interests: z\.array(z\.string())/interests: z.array(z.string()).min(1)/
  s/travelStyle: z\.string()/travelStyle: z.string().min(1)/
}' src/routes/travelAgent.ts

echo "Done! Run npm run build to check if issues are resolved."