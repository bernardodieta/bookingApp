# =============================================================================
# Stage 1: Install dependencies
# =============================================================================
FROM node:20-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/ packages/

RUN npm ci --workspace=@apoint/api --include-workspace-root

# =============================================================================
# Stage 2: Build
# =============================================================================
FROM deps AS build

WORKDIR /app

# Copy API source
COPY apps/api/ apps/api/

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build NestJS
RUN npm run build -w @apoint/api

# =============================================================================
# Stage 3: Production
# =============================================================================
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends dumb-init openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built output
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma

# Copy node_modules (hoisted at workspace root)
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/package.json package.json

ENV NODE_ENV=production

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["dumb-init", "node", "dist/src/main.js"]
