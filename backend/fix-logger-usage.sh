#!/bin/bash

echo "=== Fixing logger usage in config files ==="

# Fix database.ts
echo "Fixing database.ts..."
sed -i '' 's/import logger from '\''@\/utils\/logger'\'';/import createLogger from '\''@\/utils\/logger'\'';\nconst logger = createLogger('\''Database'\'');/g' src/config/database.ts

# Fix redis.ts  
echo "Fixing redis.ts..."
sed -i '' 's/import logger from '\''@\/utils\/logger'\'';/import createLogger from '\''@\/utils\/logger'\'';\nconst logger = createLogger('\''Redis'\'');/g' src/config/redis.ts

# Find other files that might have the same issue
echo "Finding other files with similar pattern..."
grep -r "import logger from" src --include="*.ts" | grep -v "__tests__" | cut -d: -f1 | sort | uniq | while read file; do
  if [[ "$file" != "src/utils/logger.ts" ]]; then
    echo "Checking $file..."
    # Get the service name from the file path
    service=$(basename "$file" .ts | sed 's/^\(.\)/\U\1/')
    
    # Fix the import and create logger instance
    sed -i '' "s/import logger from/import createLogger from/g" "$file"
    
    # Add the logger creation after the import if not already present
    if ! grep -q "const logger = createLogger" "$file"; then
      sed -i '' "/import createLogger from/a\\
const logger = createLogger('$service');" "$file"
    fi
  fi
done

echo "=== Logger usage fixed ==="