FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy application
COPY . .

# Generate Prisma client at build time
RUN npx prisma generate

EXPOSE 3001

# Add entrypoint to migrate and seed then start
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]



