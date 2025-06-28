#!/bin/bash

echo "=== Fixing logger imports ==="

# Fix createLogger imports to use default export
echo "Replacing createLogger imports with default logger..."

# Fix in all files that import createLogger
find src -name "*.ts" -type f | while read file; do
  # Skip test files
  if [[ ! "$file" =~ "__tests__" ]]; then
    # Replace: import createLogger from -> import logger from
    sed -i '' 's/import createLogger from/import logger from/g' "$file"
    
    # Replace: const logger = createLogger('ServiceName') -> const logger = logger.child({ service: 'ServiceName' })
    sed -i '' "s/const logger = logger('\\([^']*\\)')/const logger = logger.child({ service: '\\1' })/g" "$file"
    
    # Replace: const logger = (createLogger as any)('ServiceName') -> const logger = logger.child({ service: 'ServiceName' })
    sed -i '' "s/const logger = (logger as any)('\\([^']*\\)')/const logger = logger.child({ service: '\\1' })/g" "$file"
  fi
done

echo "=== Logger imports fixed ==="