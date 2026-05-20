# =============================================
# OfferU - Frontend Dockerfile
# =============================================

FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm config set registry https://registry.npmmirror.com/ \
  && npm ci --no-audit --no-fund

COPY . .

EXPOSE 3011

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3011"]

# ---- Production build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm config set registry https://registry.npmmirror.com/ \
  && npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- Production image ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public* ./public/

EXPOSE 3011

CMD ["node", "server.js"]
