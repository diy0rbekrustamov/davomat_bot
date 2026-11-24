# Kompyuterdan Davomat serverini ishlatish

1. Docker Desktop ochiq va ishlayotgan bo'lsin.
2. `start-local.cmd` faylini ishga tushiring. U serverni va tashqi HTTPS tunnelni nazorat qiladi.
3. Joriy tashqi manzil `local-runtime/public.env` faylida turadi. Kompyuterda panel: http://localhost:4000, o'qituvchi paneli: http://localhost:4000/teacher/.
4. Foydalanuvchilar Telegram'dagi @bst_davomat_bot orqali `/start` ni bosib, bo'limni qayta ochishadi. Bot menyusi yangi manzilga avtomatik yangilanadi.

Kompyuter, internet va Docker ishlashi kerak. Kompyuter o'chsa yoki uyqu holatiga o'tsa, xizmat to'xtaydi.

Vaqtinchalik trycloudflare.com manzili tunnel qayta ochilganda almashishi mumkin. `start-local.ps1` yangi manzilni topib, botni avtomatik qayta sozlaydi. Eski `davomat.provveb.uz` domeni oldingi serverga yo'naltirilgan; bu sozlama domen DNS yozuvini o'zgartirmaydi.

Asosiy ma'lumotlar bazasi mavjud GitHub saqlash mexanizmi orqali ishlaydi. Konteynerdagi `/ram` vaqtinchalik; mavjud `live_database/dev.db` zaxirasi o'zgartirilmaydi.

Davomat eslatmasi har kuni Toshkent vaqti bilan **08:20** da, o'sha kuni hali davomat boshlamagan faol o'qituvchilarga yuboriladi. Xabarda 08:30 dagi davomat eslatiladi. Faqat developer hisobida `/start` yoki `/reminders` orqali reply klaviaturadagi eslatmalarni o'chirish/yoqish tugmasi chiqadi. Bu sozlama barcha o'qituvchilarga tegishli va GitHub bazasida saqlanadi.

Guruhlar bo'limidagi **Barcha QR kodlar — ZIP (A4)** tugmasi joriy foydalanuvchiga ko'rinadigan barcha guruhlar uchun A4 PNG rasmlarini bitta `Guruhlar_QR_A4.zip` hujjatida bot orqali yuboradi. Rasmlar 1240×1754 o'lchamida va guruh nomi bilan saqlanadi. Takroriy fayl nomlariga raqam qo'shiladi. Biror QR rasmi yuklanmasa, xatolik ko'rsatiladi va to'liq bo'lmagan ZIP yuborilmaydi.

Tekshirish:

```powershell
docker ps --filter name=davomat-local
docker logs --tail 40 davomat-local
```

To'xtatish: nazorat skriptini to'xtating, so'ng `docker stop davomat-local` buyrug'ini bajaring. Tunnel jarayon raqami `local-runtime/tunnel.pid` ichida saqlanadi.
