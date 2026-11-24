FROM davomat:fullscreen-20261027
WORKDIR /app
COPY packages/db/github-store.cjs packages/db/index.d.ts ./packages/db/
COPY apps/backend/src ./apps/backend/src
COPY apps/bot/src ./apps/bot/src
COPY apps/admin-panel/src ./apps/admin-panel/src
COPY apps/teacher-app/src ./apps/teacher-app/src
RUN npm run build --workspace backend && npm run build --workspace bot && npm run build --workspace admin-panel && npm run build --workspace teacher-app
CMD ["node", "start-production.cjs"]
