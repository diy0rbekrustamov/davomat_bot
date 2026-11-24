FROM davomat:restart-20261026
WORKDIR /app
COPY apps/backend/src ./apps/backend/src
COPY apps/admin-panel/src ./apps/admin-panel/src
COPY apps/teacher-app/src ./apps/teacher-app/src
RUN npm run build --workspace backend && npm run build --workspace admin-panel && npm run build --workspace teacher-app
CMD ["node", "start-production.cjs"]
