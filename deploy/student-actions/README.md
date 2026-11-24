# O'quvchini tahrirlash va o'chirish — 2026-10-27

Admin panel va o'qituvchi Mini App guruh o'quvchilari ro'yxatida qalam/tahrirlash hamda o'chirish tugmalari mavjud. Tahrir formasi shu qatorda ochiladi; Saqlash va Bekor tugmalari, band holati bor. O'chirish alohida tasdiq talab qiladi va mavjud AttendanceRecord cascade ta'siri aniq yozilgan. Ismni tahrirlash student ID va davomat yozuvlarini saqlaydi. DB sxemasi o'zgarmadi.

PATCH /api/students/:id faqat ismFamiliya qabul qiladi; trim, 1–200 belgi. Guruhni almashtirish qabul qilinmaydi. O'qituvchi faqat o'z guruhini tahrirlaydi; faol bo'lmagan guruhda tahrirlash rad etiladi. Mavjud DELETE endpoint qayta ishlatilgan. Mutatsiyalar auditdan o'tgan GitHub commit/response middleware orqali saqlanadi.

Image: davomat:students-20261027, base davomat:restart-20261026. Faqat backend/admin-panel/teacher-app qayta build qilinadi; bot va restart-control o'zgarmaydi. Build va alohida network-none sinovlari tugagach, deploy.sh eski audited checkpoint yordamida backup olib app servisinigina almashtiradi. Caddy/Provveb o'zgartirilmaydi.

Tekshirish: deploy/student-actions/integration.cjs — soxta GitHub serveri, alohida SQLite, sintetik Telegram HMAC bilan real API/Prisma testlari. Ishlab turgan bazada test o'quvchi yoki test davomat yaratilmaydi.

Rollback: shu release ichida bash deploy/student-actions/deploy.sh --rollback; oldingi davomat:restart-20261026 image ishlatiladi, joriy baza eski nusxaga almashtirilmaydi. Health holatini keyin tekshiring.

Fan kichik guruhlari bo'yicha taklif (hali amalga oshirilmagan): asosiy Group saqlanadi; fan/o'qituvchi/membership bilan LessonSubgroup yaratiladi. AttendanceSession ixtiyoriy subgroupId oladi; tanlangan kichik guruh o'quvchilari uchun yozuv yaratiladi, qolganlar yo'q deb belgilanmaydi. Butun guruh darsi subgroupId bo'sh bo'lganda ishlaydi. Membership o'zgarishi tarixiy sessiya yozuvlarini o'zgartirmaydi. Fan bo'yicha kichik guruhlarning ustma-ust tushishi va davomat takrorlanishi tekshirilishi kerak.
