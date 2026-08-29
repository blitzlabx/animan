# Animan by Blitz (blitzlabx) — Render-ready
FROM node:20-slim

# better-sqlite3 needs build tools
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install typescript --no-save && npx tsc && npm uninstall typescript

# Data dir for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
