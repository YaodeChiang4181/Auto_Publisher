FROM node:20-slim

# Install latest chrome dev package and fonts to support major charsets
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to skip installing Chrome since we just installed google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json ./
# Render 預設會在編譯時注入 NODE_ENV=production，這會略過 devDependencies (導致找不到 tsc 與 prisma)
# 加上 --include=dev 強制安裝編譯所需套件
RUN npm install --include=dev

COPY . .

# Generate Prisma Client and build TypeScript
RUN npx prisma generate
RUN npm run build

# Render expects dynamic port, exposing default 3000 just in case
EXPOSE 3000

CMD ["npm", "start"]
