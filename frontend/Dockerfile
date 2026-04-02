# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (using ci for reproducible installs)
COPY package*.json ./
RUN npm ci

# Copy source files and build the production assets
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine

# Copy the built static files into Nginx's html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose the default HTTP port
EXPOSE 80

# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]