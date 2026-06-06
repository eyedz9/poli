FROM node:22-alpine AS base
WORKDIR /app

# ─── deps ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ─── dev (default) ─────────────────────────────────────────────────────
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ─── build ─────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npm run build

# ─── production (nginx) ────────────────────────────────────────────────
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
