# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g npm@11.17.0 --loglevel=error
COPY package*.json ./
RUN npm install --loglevel=error --no-audit --no-fund
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]