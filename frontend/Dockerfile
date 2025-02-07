# Build stage
FROM node:18-alpine

WORKDIR /app

# Add build arguments
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_BACKEND_WS_URL
ARG NODE_ENV

# Set environment variables
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_WS_URL=$REACT_APP_BACKEND_WS_URL
ENV NODE_ENV=$NODE_ENV

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install serve
RUN npm install -g serve

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Expose port 3000 (default serve port)
EXPOSE 3000

# Start serve
CMD ["serve", "-s", "build"] 