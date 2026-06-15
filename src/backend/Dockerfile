# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copy configuration files and dependencies
COPY package*.json ./
COPY .npmrc ./

# Install dependencies using legacy-peer-deps configuration
RUN npm install

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

EXPOSE 3000

CMD ["node", "dist/src/main"]