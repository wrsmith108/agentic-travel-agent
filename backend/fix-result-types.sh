#!/bin/bash

# Fix script to update Result type usage across the codebase

echo "Fixing Result type usage in flight routes..."

# Fix flights.ts
sed -i '' 's/!result\.success/!isOk(result)/g' src/routes/flights.ts
sed -i '' 's/result\.success/isOk(result)/g' src/routes/flights.ts
sed -i '' 's/result\.data/result.value/g' src/routes/flights.ts
sed -i '' 's/result\.error/result.error/g' src/routes/flights.ts

# Add isOk import to flights.ts if not present
if ! grep -q "import.*isOk.*from.*result" src/routes/flights.ts; then
  sed -i '' '/import.*from.*@\/utils\/logger/a\
import { isOk, isErr } from '\''@/utils/result'\'';' src/routes/flights.ts
fi

echo "Fixing Result type usage in sessionStore..."

# Fix sessionStore.ts
sed -i '' 's/!result\.success/!result.ok/g' src/services/redis/sessionStore.ts
sed -i '' 's/result\.success/result.ok/g' src/services/redis/sessionStore.ts
sed -i '' 's/result\.data/result.value/g' src/services/redis/sessionStore.ts

echo "Fixing Result type usage in JWT utils..."

# Fix jwt.ts
sed -i '' 's/decoded\.error/decoded.error/g' src/utils/jwt.ts
sed -i '' 's/accessResult\.error/accessResult.error/g' src/utils/jwt.ts
sed -i '' 's/refreshResult\.error/refreshResult.error/g' src/utils/jwt.ts

echo "Fixing session access in routes..."

# Fix session access in flights.ts
sed -i '' 's/req\.session\?\./getSessionData(req)?./g' src/routes/flights.ts
sed -i '' 's/req\.session\//getSessionData(req)\//g' src/routes/flights.ts

# Add getSessionData import to flights.ts if not present
if ! grep -q "import.*getSessionData.*from.*session" src/routes/flights.ts; then
  sed -i '' 's/import { requireAuth, attachSessionInfo }/import { requireAuth, attachSessionInfo, getSessionData }/' src/routes/flights.ts
fi

echo "Done! Please run 'npm run build' to check if issues are resolved."