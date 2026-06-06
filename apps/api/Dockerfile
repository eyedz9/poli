FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ─── deps ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /prod_modules
RUN npm ci

# ─── build ─────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npm run build

# ─── runtime ───────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /prod_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
