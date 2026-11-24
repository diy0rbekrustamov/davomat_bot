FROM davomat:delete-reports-20261027
COPY apps/backend/src/controllers/attendance.controller.ts /app/apps/backend/src/controllers/attendance.controller.ts
RUN npm run build --workspace backend
CMD ["node", "start-production.cjs"]
