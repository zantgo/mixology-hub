# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copiar archivos de configuración y dependencias
COPY package*.json ./
COPY .npmrc ./

# Instalar dependencias usando la configuración de legacy-peer-deps
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar NestJS
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/main"]