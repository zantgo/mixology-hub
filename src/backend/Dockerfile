# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Match packageManager version from package.json
RUN npm install -g npm@11.17.0 --loglevel=error

# Copy configuration files and dependencies
COPY package*.json ./

# Install dependencies (suppress audit, fund, and deprecation warnings)
RUN npm install --loglevel=error --no-audit --no-fund --legacy-peer-deps

# Copy the rest of the code
COPY . .

# Compile NestJS
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p /app/uploads && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "dist/src/main"]