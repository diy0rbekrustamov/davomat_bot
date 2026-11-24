FROM davomat:performance-20261027
WORKDIR /app
COPY packages/shared/src ./packages/shared/src
COPY apps/bot/src ./apps/bot/src
COPY apps/backend/src ./apps/backend/src
COPY apps/teacher-app/src ./apps/teacher-app/src
RUN ./node_modules/.bin/tsc -p packages/shared/tsconfig.json && npm run build --workspace bot && npm run build --workspace backend && npm run build --workspace teacher-app
CMD ["node", "start-production.cjs"]

