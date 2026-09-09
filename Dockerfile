FROM node:22-alpine
WORKDIR /app
# Server dependencies
COPY server/package*.json ./
RUN npm ci
# Prisma
COPY server/prisma ./prisma
RUN npx prisma generate
# Source
COPY server/src ./src
COPY server/scripts ./scripts
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss || true; node src/index.js"]
