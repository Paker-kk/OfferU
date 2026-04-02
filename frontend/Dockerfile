# =============================================
# OfferU - Frontend Dockerfile
# =============================================

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# public 目录可能为空，用通配符避免构建失败
COPY --from=builder /app/public* ./public/

EXPOSE 3000

CMD ["node", "server.js"]
