#!/bin/sh
# Start script for production - runs migrations then starts the server

echo "Running database migrations..."
pnpm db:migrate:deploy

echo "Starting server..."
exec node dist/index.js
