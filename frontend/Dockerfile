# Stage 1: Build
FROM node:22-slim AS build

WORKDIR /app

# Enable corepack for yarn
RUN corepack enable

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install

# Copy source code
COPY . .

# Build with VITE_API_URL argument
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN yarn build

# Stage 2: Serve
FROM nginx:alpine

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
