FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
# Prisma client үүсгэх (schema хуулсны дараа)
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY scripts ./scripts
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss || true; node src/index.js"]
