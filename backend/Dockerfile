FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 4000

CMD ["npm", "start"] 