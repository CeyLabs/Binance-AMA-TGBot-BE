# Use Node.js 22 Alpine for smaller image size
FROM node:22-alpine

# Install curl for health check and PostgreSQL client for wait script
RUN apk add --no-cache curl postgresql-client bash

# Install bun using the official installer
RUN curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json bun.lock* ./

# Install all dependencies first (needed for build)
RUN bun install

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Create a script to wait for database and run migrations
RUN printf '#!/bin/sh\n\
echo "Waiting for database to be ready..."\n\
until pg_isready -h $PG_HOST -p $PG_PORT -U $PG_USER; do\n\
  echo "Database is unavailable - sleeping"\n\
  sleep 2\n\
done\n\
echo "Database is ready!"\n\
echo "Running database migrations..."\n\
bun run migrate\n\
echo "Starting application..."\n\
exec "$@"\n' > /app/wait-for-db.sh && chmod +x /app/wait-for-db.sh

# Remove dev dependencies after build to reduce image size
RUN bun install --production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application with database wait script
ENTRYPOINT ["/app/wait-for-db.sh"]
CMD ["bun", "run", "start:prod"]