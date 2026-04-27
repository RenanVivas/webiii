FROM mcr.microsoft.com/playwright:v1.50.0-jammy

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies (this includes Playwright but we already have browsers in the base image)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Expose the dynamic port (PaaS usually handles this, but good for local docker run)
EXPOSE 3002

# Start the application
CMD ["npm", "start"]
