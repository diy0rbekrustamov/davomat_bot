FROM davomat:students-20261027
WORKDIR /app
COPY apps/admin-panel/src ./apps/admin-panel/src
COPY apps/teacher-app/src ./apps/teacher-app/src
COPY apps/admin-panel/public ./apps/admin-panel/public
COPY apps/teacher-app/public ./apps/teacher-app/public
COPY apps/admin-panel/index.html ./apps/admin-panel/index.html
COPY apps/teacher-app/index.html ./apps/teacher-app/index.html
RUN npm run build --workspace admin-panel && npm run build --workspace teacher-app
CMD ["node", "start-production.cjs"]
