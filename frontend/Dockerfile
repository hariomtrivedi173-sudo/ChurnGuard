# Stage 1: Build Vite React App
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies using package-lock.json
COPY frontend/package*.json ./
RUN npm ci

# Build arguments for Vite environment (defaults to http://localhost:8000 for local builds)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Copy frontend source and compile production bundle
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
