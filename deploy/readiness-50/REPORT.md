# 50 o‘qituvchi uchun ishga tayyorlik auditi — 2026-10-28

## Tekshiruv muhiti

Asosiy bot to‘xtatilmagan holda tekshirildi. Yozish va rasm yuklash yuklama sinovlari alohida, tarmoqqa chiqmaydigan Docker konteynerida, haqiqiy backend/Prisma/SQLite va soxta GitHub HTTP serverida bajarildi. Sinov GitHub serveri har javobga 100 ms kechikish qo‘shadi; bu internetdagi haqiqiy GitHub tezligi yoki xizmat kafolati emas. Production bazaga test o‘qituvchi, davomat yoki rasm kiritilmadi, Telegramga test xabar yuborilmadi.

## Asosiy server tekshiruvi

- 11 960 MB RAM, taxminan 1 125 MB ishlatilgan; 185 GB disk bo‘sh.
- Davomat konteyneri healthy; restartCount=0, OOM=false.
- GitHub tarmoq so‘rovi 449 ms, Telegram getMe muvaffaqiyatli; polling, pending_update_count=0.
- GitHub pending storage journal yo‘q; SQLite PRAGMA integrity_check=ok.
- 29 faol o‘qituvchi, 12 faol guruh, 518 o‘quvchi. 50 ta ishlatilishi uchun barcha foydalanuvchilar alohida ro‘yxatda faol bo‘lishi kerak.
- Haqiqiy serverdagi 50 parallel, faqat o‘qish API so‘rovi: 0 xato; median 4 932 ms, p95 8 667 ms, eng ko‘pi 8 995 ms.
- Hisobot/deletion faol navbati bo‘sh; 62 ta report delivered. 28 ta reminder delivered, 1 ta REMINDER_UNDELIVERABLE (Baxtiyorova Saodat). Xato holati avvalgi kunga tegishli; worker aniq Telegram error_description saqlamagan, shuning uchun bloklagan deb qat’iy xulosa qilinmadi. Botdan /start qilib foydalanish huquqini qayta tekshirish kerak.
- Eslatma yoqilgan, jadval 08:20 Asia/Tashkent. Yaqinda saqlangan rasm manziliga HEAD 200.
- ANNOUNCEMENT_QUEUED yagona eski ota yozuv 2026-10-07 sanali, faqat messageId bor; bu hozir yuborilayotgan attendance queue emas.

## Tuzatish

AttendanceController.addPhotos oldin har rasm uchun pushFiles chaqirgan: besh rasmga besh ketma-ket asset commit. Endi asl besh buffer bitta pushFiles to‘plami orqali saqlanadi. Barcha rasm saqlanishi tasdiqlangach, o‘qituvchi/sessiya huquqi yana tekshirilib, beshta reference bazaga commit qilinadi. Tasvir qayta siqilmaydi. Asset commit xatosida bazaga muvaffaqiyatli rasm reference yozilmaydi.

## Sinovlar

54 ta regression testi o‘tdi: queue/shutdown, album, developer archive/deletion, restart, reminder, notify, QR ZIP va yangi photo batch muvaffaqiyat/xato yo‘li. Real multipart HTTP upload sinovi 5 ta asl buffer saqlanganini tekshiradi. Backend integration permission, noto‘g‘ri Telegram imzo, eski auth_date, blocked account, boshqa guruhga kirish, commit/lost ACK/journal recovery va deletion archive himoyasini tekshiradi.

Dastlabki 50 foydalanuvchi sinovi 50 sessiya, 1 500 davomat yozuvi, 50 yakunlangan hisobotni tasdiqladi; yo‘qolgan yozuv yo‘q. Eng uzun yakunlash 41 748 ms bo‘ldi. GitHub-primary yozishlar ketma-ketligi tufayli bir vaqtda saqlashda kutish mavjud; tezlik internet va tashqi API javoblariga bog‘liq.

To‘liq rasmli sinovning aniq natijalari alohida full-load.log faylida saqlanadi. Yangilanish faqat 250 rasm, 1 500 yozuv, 50 report va barcha testlar tasdiqlangandan keyin deploy qilinadi. Deploy oldidan ikki baza nusxasining integrity tekshiruvi qilinadi; Caddy/Provveb xizmatlari qayta ishga tushirilmaydi.

## Natija chegarasi

Sinovlarda xato topilmasligi kelajakdagi barcha internet, Telegram yoki GitHub nosozliklari bo‘lmasligini kafolatlamaydi. Haqiqiy 50 foydalanuvchining interneti, kamerasi va Telegram klienti alohida real qurilmalarda sinovdan o‘tkazilmadi. Soxta GitHub xizmatida primary/secondary rate limit yoki real internet o‘zgarishi emulyatsiya qilinmadi. Mavjud retry/journal va holat xabarlari saqlanadi; tasdiqlanmagan yozish muvaffaqiyatli deb qaytarilmaydi.

## To‘liq yuklama sinovi va deploy natijasi

`davomat:readiness-50-20261028` image 2026-10-28 kuni productionga qo‘llandi. Baza zaxiralari `/opt/davomat/audit-20261026/backups/cutover-20261028T023142-1098510/` da, ikkala integrity tekshiruvi o‘tgan. `/opt/davomat/current` → `/opt/davomat/releases/20261028-readiness-50`. Health=healthy, restartCount=0, /ready: storage=github, bot=running; public HTTPS 200. Caddy va Provveb konteynerlari ID/startedAt o‘zgarmagan. Asosiy serverdagi deploydan keyingi o‘qishlar: deletions 398 ms, groups/page-data 95 ms, dashboard 81 ms.

Har bir bosqichda 50 parallel so‘rov, 0 xato:

| Bosqich | Median | p95 | Eng uzoq |
|---|---:|---:|---:|
| Guruhlarni ochish | 2 123 ms | 3 670 ms | 3 918 ms |
| Sessiya boshlash | 14 242 ms | 27 757 ms | 29 745 ms |
| 1 500 yozuvni saqlash | 17 085 ms | 32 261 ms | 33 432 ms |
| 250 rasmni yuklash | 45 772 ms | 71 220 ms | 72 827 ms |
| 50 hisobotni yakunlash | 22 834 ms | 37 832 ms | 39 171 ms |
| Tarixni ochish | 3 897 ms | 5 667 ms | 5 759 ms |

Yakuniy SQLite nusxasida aynan 50 yakunlangan sessiya, 1 500 record va 50 pending report tasdiqlandi, integrity=ok. Reportlarni real Telegramga yetkazish yuklama sinovi bajarilmadi: test soxta Telegram xabarlari yubormaydi. Album yuborish/retry/deletion alohida regression testlar bilan tekshirildi. Test rasmlari original JPEG o‘rnidagi kichik deterministik bufferlar; 250 ta katta real kamera faylining bandwidth yoki maksimal RAM sinovi deb talqin qilinmaydi. Shu sababli 73 soniya haqiqiy internet uchun yuqori chegara emas.

Dalillar VPSdagi `/opt/davomat/readiness-50/` ichida: `full-load.log`, `tests.log`, `photo-integration.log`, `integration-new.log`, `deploy.log`. Lokal test manbalari shu katalogning repodagi nusxasida va `apps/backend/tests/photo-batch.test.cjs` ichida. Rollback: `/opt/davomat/rollback-readiness-50.sh`, joriy bazani eski nusxaga almashtirmaydi; faol queue bo‘lsa almashtirishni rad etadi.
