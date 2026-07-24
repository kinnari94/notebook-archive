FROM node:22-bookworm

WORKDIR /app

# System deps for Python + Playwright's Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Node deps
COPY package.json package-lock.json ./
RUN npm ci

# Python deps in an isolated venv, browser binaries + OS libs via playwright install
COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt \
    && /opt/venv/bin/playwright install --with-deps chromium
ENV PATH="/opt/venv/bin:${PATH}"

# App source + build
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
