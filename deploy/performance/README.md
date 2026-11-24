# Tezlik optimizatsiyasi — 2026-10-27

GitHub dev.db asosiy saqlash joyi bo'lib qoladi. Faqat readOnly deb aniq belgilangan GET/HEAD va queue-list so'rovlari hash tasdiqlangan RAM snapshotni qisqa vaqt qayta ishlatadi: API 2s, fon navbat ro'yxati 5s. Vaqt cache hit bilan uzaytirilmaydi. Umumiy flock, orphan/WAL tekshiruvi, strict writer, durable journal, SHA conflict tekshiruvi saqlanadi. Pending journal bor bo'lsa cache ishlatilmaydi, oldin reconciliation o'tadi. Read-only callback faylni o'zgartirsa PUT qilinmaydi, snapshot tiklanadi va so'rov xato qaytaradi. GitHub ishlamay qolganda muddati o'tgan keshdan javob berilmaydi.

GitHub ETag + If-None-Match/304 va SHA teng bo'lsa tanilgan bytes ishlatiladi. Yozishlar har safar GitHubda qayta tekshiriladi; TTL ularga qo'llanmaydi. Bir xil DB/cache fayli qayta yozilmaydi. Eski versiya cache metadatasidagi ortiqcha maydonlarni e'tiborsiz qoldiradi, rollback mos.

GET /api/groups/page-data o'z ruxsat doirasidagi guruhlar, o'qituvchilar va Telegram chatlarni bitta transactionda qaytaradi. GET /api/dashboard faqat admin uchun oldingi 3 so'rovni birlashtiradi. Frontendlar yangi endpointlardan foydalanadi. HTTP javoblar foydalanuvchilar orasida keshlanmaydi; har safar role/scope SQL bilan tekshiriladi.

Tekshiruv: Windows 27 testdan 26 pass, 1 Linux-only skip; Linux 27 testdan 25 pass, 2 Windows-only skip. Concurrency, owner crash, orphan, write conflict, lost ACK, pending recovery, readonly-write rejection, TTL expiry, ETag, processlararo cache qayta foydalanish tekshirildi. Haqiqiy backend/Prisma + fake GitHub integratsiyasi, 23 worker/regression testi o'tdi. Sinovda production bazaga test yozuv yuborilmagan. Alohida canary bot disabled va alohida state bilan real GitHub o'qish benchmarki o'tkazildi.

VPS ichidagi o'lchov (foydalanuvchi internetidan tashqari): oldingi Guruhlar 4080ms / 3 request; dashboard 5127ms / 3 request. Yangi canary GroupsPage 445ms (birinchi), 219ms (takroriy); dashboard 221ms, 212ms / 1 request. Bu doimiy tezlik kafolati emas; GitHub write/commit tashqi xizmatga bog'liq qoladi.

Image davomat:performance-20261027, base davomat:fullscreen-20261027. Release /opt/davomat/releases/20261027-performance. deploy.sh backup+checkpointdan keyin faqat appni almashtiradi. Rollback: bash deploy/performance/deploy.sh --rollback; kod fullscreen imagega qaytadi, DB eski backupga almashtirilmaydi.
