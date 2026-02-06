# syntax=docker/dockerfile:1.4

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:18-alpine AS dependencies

WORKDIR /app

# Copy package files only
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
# Use BuildKit cache mount to speed up npm downloads
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM dependencies AS builder

WORKDIR /app

# Build arguments for React app
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_BACKEND_WS_URL
ARG NODE_ENV

# Set environment variables for build
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_WS_URL=$REACT_APP_BACKEND_WS_URL
ENV NODE_ENV=$NODE_ENV

# Copy source code (selective copying for better caching)
COPY public/ ./public/
COPY src/ ./src/
COPY tsconfig.json ./

# Build the React application
RUN npm run build

# ============================================
# Stage 3: Runtime (Production)
# ============================================
FROM node:18-alpine AS runtime

WORKDIR /app

# Install serve globally BEFORE copying build artifacts
# This ensures better layer caching
RUN npm install -g serve

# Copy ONLY the build output from builder stage
# This excludes all 519 MB of node_modules and source code
COPY --from=builder /app/build ./build

# Expose port 3000 (default serve port)
EXPOSE 3000

# Start serve
CMD ["serve", "-s", "build"]
