FROM davomat:reports-20261027
WORKDIR /app
COPY packages/shared/src ./packages/shared/src
COPY apps/bot/src ./apps/bot/src
COPY apps/backend/src ./apps/backend/src
COPY apps/admin-panel/src ./apps/admin-panel/src
RUN ./node_modules/.bin/tsc -p packages/shared/tsconfig.json && npm run build --workspace bot && npm run build --workspace backend && npm run build --workspace admin-panel
CMD ["node", "start-production.cjs"]
