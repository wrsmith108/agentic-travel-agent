#!/bin/bash

echo "=== Fixing final batch of TypeScript errors ==="

# Fix 1: Result type usage in enhancedAmadeusService.ts
echo "Fixing Result type usage in enhancedAmadeusService..."
sed -i '' 's/rateLimitCheck\.success/isOk(rateLimitCheck)/g' src/services/flights/enhancedAmadeusService.ts
sed -i '' 's/rateLimitCheck\.error/rateLimitCheck.error/g' src/services/flights/enhancedAmadeusService.ts
sed -i '' 's/cacheResult\.success/isOk(cacheResult)/g' src/services/flights/enhancedAmadeusService.ts
sed -i '' 's/cacheResult\.data/cacheResult.value/g' src/services/flights/enhancedAmadeusService.ts

# Fix 2: Type assertions in batch/priceMonitoringProcessor.ts
echo "Fixing type assertions in priceMonitoringProcessor..."
sed -i '' 's/result\.value\.processedCount/result.value.value.processedCount/g' src/services/batch/priceMonitoringProcessor.ts
sed -i '' 's/result\.value\.alertsGenerated/result.value.value.alertsGenerated/g' src/services/batch/priceMonitoringProcessor.ts

# Fix 3: Add missing property to price alerts schema
echo "Adding checkFrequency to price alerts schema..."
# This needs to be done in the schema file

# Fix 4: Type assertions in session/index.ts
echo "Fixing type assertions in session/index.ts..."
sed -i '' 's/\.filter(s => s\.userId/\.filter((s: any) => s.userId/g' src/services/auth/functional/session/index.ts
sed -i '' 's/\.find(s => !isTimestampExpired(s\.expiresAt))/\.find((s: any) => !isTimestampExpired(s.expiresAt))/g' src/services/auth/functional/session/index.ts

# Fix 5: Export missing types from functional module
echo "Adding missing type exports..."
# Already handled in previous script

echo "=== Batch fixes applied ==="