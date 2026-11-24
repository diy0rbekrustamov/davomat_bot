FROM davomat:audit-20261026
WORKDIR /app
COPY apps/bot/src ./apps/bot/src
RUN npm run build --workspace bot
CMD ["node","start-production.cjs"]
