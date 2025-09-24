#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Navigate to your app directory (change as needed)
cd /home/bots/tg_ama_bot

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Start the app (change to your actual start command if different)
# You may want to use 'nohup' or 'pm2' for process management in production
nohup bun run start > app.log 2>&1 &

echo "Application started! Logs are in app.log"
