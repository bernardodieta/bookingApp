# =============================================================================
# Stage 1: Install dependencies
# =============================================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ packages/

RUN npm ci --workspace=@apoint/web --include-workspace-root

# =============================================================================
# Stage 2: Build
# =============================================================================
FROM deps AS build

WORKDIR /app

# Build-time env vars (baked into Next.js static output)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Copy web source
COPY apps/web/ apps/web/

# Build Next.js (standalone output)
RUN npm run build -w @apoint/web

# =============================================================================
# Stage 3: Production
# =============================================================================
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy standalone server
COPY --from=build /app/apps/web/.next/standalone ./
# Copy static assets
COPY --from=build /app/apps/web/.next/static apps/web/.next/static
# Copy public assets (if any)
COPY --from=build /app/apps/web/public apps/web/public

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["dumb-init", "node", "apps/web/server.js"]
