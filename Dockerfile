FROM node:20-bullseye

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/bot/package.json apps/bot/
COPY apps/admin-panel/package.json apps/admin-panel/
COPY apps/teacher-app/package.json apps/teacher-app/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/

RUN npm install

COPY . .

RUN cd packages/db && npx prisma generate

EXPOSE 4000

CMD ["node", "start-all.js"]
