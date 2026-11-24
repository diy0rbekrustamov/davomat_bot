# Maktab Davomat Nazorati Tizimi

Bu loyiha Maktab, Litsey yoki Kollejlar uchun QR-kod asosidagi davomat nazorati tizimi hisoblanadi. Loyiha zamonaviy Monorepo arxitekturasida yozilgan.

## Texnologiyalar
- **Ma'lumotlar bazasi:** PostgreSQL + Prisma ORM
- **Backend:** Node.js, Express.js, TypeScript, Zod
- **Bot:** grammY (Telegram bot)
- **Frontend (Mini Apps):** React, Vite, Tailwind CSS, shadcn/ui (dizayn uchun)

## Loyiha Tuzilishi
- `/apps/backend` - REST API (Sessiyalar, Guruhlar, Excel import logikalari)
- `/apps/bot` - Telegram bot, Cron-joblar (Eslatmalar)
- `/apps/admin-panel` - Admin uchun Telegram Mini App
- `/apps/teacher-app` - O'qituvchilar uchun QR skanerli Telegram Mini App
- `/packages/db` - Prisma schema va baza logikasi
- `/packages/shared` - Umumiy util funksiyalar (Telegram initData tekshiruvi)

## O'rnatish (Installation)

1. Repozitoriyni yuklab oling va barcha dependency'larni o'rnating:
   ```bash
   npm install
   ```

2. `.env.example` faylini nusha ko'chirib, `.env` faylini yarating va o'z ma'lumotlaringizni (PostgreSQL URL, Bot Token) kiriting:
   ```bash
   cp .env.example .env
   ```

3. Ma'lumotlar bazasini initsializatsiya qiling:
   ```bash
   cd packages/db
   npx prisma db push
   npx prisma generate
   ```

## Ishga tushirish (Development rejimida)

Monorepo qismlarini alohida terminal oynalarida ishga tushiring:

**Backend:**
```bash
cd apps/backend
npm run dev
```

**Telegram Bot:**
```bash
cd apps/bot
npm run dev
```

**Admin Panel Mini App:**
```bash
cd apps/admin-panel
npm run dev
```

**Teacher Mini App:**
```bash
cd apps/teacher-app
npm run dev
```

## Production'ga joylash
- Backend va Bot alohida portlarda ishlashi mumkin. Bot uchun `.env` da `BOT_MODE="webhook"` qilib sozlash tavsiya etiladi.
- Mini applar (`admin-panel` va `teacher-app`) `npm run build` orqali static fayllarga aylanadi va istalgan static hosting (masalan: Vercel, Netlify yoki Nginx) ga joylashtiriladi. Ularning manzili (URL) botdagi (BotFather) Mini App menyusiga ulanadi.

## Xavfsizlik
Barcha so'rovlar Telegram tomonidan beriladigan `initData` orqali himoyalangan. Ya'ni Mini App faqat bot ichida haqiqiy foydalanuvchi tomonidan ochilgandagina ishlaydi.
