# =============================================
# OfferU - Frontend Dockerfile
# =============================================

FROM node:20-alpine AS builder

WORKDIR /app

# 如需使用 SteamTools MITM 代理，请取消下面的注释并确保证书存在
# COPY certs/steamtools-ca.pem /usr/local/share/ca-certificates/steamtools-ca.crt 2>/dev/null || true
# RUN cat /usr/local/share/ca-certificates/steamtools-ca.crt >> /etc/ssl/certs/ca-certificates.crt 2>/dev/null || true

# Node.js 信任链：https 模块 → NODE_EXTRA_CA_CERTS；fetch/undici → SSL_CERT_FILE
# ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/steamtools-ca.crt
# ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
# ENV NODE_OPTIONS=--use-openssl-ca

COPY package.json package-lock.json* ./
RUN npm config set registry https://registry.npmjs.org/ \
  && npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# `public` 目录可能为空，使用通配避免复制失败
COPY --from=builder /app/public* ./public/

EXPOSE 3011

CMD ["node", "server.js"]
