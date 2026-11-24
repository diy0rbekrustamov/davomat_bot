# Davomat chuqur audit — 2026-10-26 (Asia/Tashkent)

## Natija

Tekshirilgan image: `davomat:audit-20261026`, SHA256 `090cb685120b53e3979928d53889e2d053be3e30e91d796c2d9df52c48c82155`.
Release: `/opt/davomat/releases/20261026-audit`; `/opt/davomat/current` shu release'ga yo‘naltirildi. Bot: `@bst_davomat_bot`, polling. Audit vaqtida eski bot ishladi; tasdiqlangan image chiqarilishida faqat Davomat konteyneri almashtirildi. Caddy va Provveb konteyner ID hamda startedAt qiymatlari o‘zgarmadi.

## Tasdiqlangan sabablar va farazlar

- Eski `withGithubDatabase` butun bot middleware'i va API callback'i uchun umumiy qulf ushlagan. Attendance, access notice, reminder, startup menu va ayrim media/QR yo‘llari tashqi tarmoq javobini shu qulf ichida kutgan. Sekin Telegram barcha bazali so‘rovlarni kutishga majbur qila olgan; bu sinovda qayta ko‘rsatildi.
- Eski `finally` ichidagi `$disconnect()` xatosi lock release'ni tashlab ketishi mumkin edi. Bu xato yo‘li uchun regression test qo‘shildi.
- Botda commitdan keyingi Telegram reply xatosi ham noto‘g‘ri GitHub xatosi sifatida ko‘rsatilgan. Runtime diagnostikasi faqat dist faylida bo‘lgan; manbaga ko‘chirildi.
- Host, image va runtime o‘rtasidagi farq tekshirildi: live announcement va bot.js hotfix'lari asl image'da bo‘lmagan. Qaytish image'i aynan shu ikki live fayl bilan qayta tayyorlandi.
- `/root/davomat-3h.log` da access/attendance queue xatolari tasdiqlandi. E’lon hodisani aynan boshlagani yoki eski `$disconnect` o‘sha kuni osilgani qat’iy isbotlanmagan; ular sabab sifatida da’vo qilinmaydi.

## Saqlash va qulflar

GitHub primary saqlandi: `provveb/database_davomat_byprovveb`, branch `main`, fayl `dev.db`. SQLite URL `file:/ram/dev.db`, haqiqiy tmpfs. Journal mode amalda `delete`; `.Mounts` bo‘shligidan xulosa chiqarilmadi, kernel mount va df bilan tekshirildi.

`packages/db/github-store.cjs`:

- Linux kernel `flock` protsesslar orasida serializatsiya qiladi; tirik egani yoshi sababli o‘chirmaydi. Protsess o‘lsa stdin yopilib kernel lock bo‘shaydi. Windows test muhiti uchun eski PID/token usuli alohida fallback.
- Atomik snapshot install, Git blob SHA tekshiruvi, bounded GET retry va bekor qilinadigan fetch timeoutlari.
- 401/403/404/409/422/429/5xx va tarmoq xatolari alohida kodlar.
- PUT yo‘qolgan javobi keyingi GET bilan tekshiriladi. Faqat o‘sha base SHA va o‘sha candidate qayta yuboriladi. Boshqa yozuvchi yangi SHA yaratgan bo‘lsa ko‘r-ko‘rona overwrite yo‘q.
- Tasdiqlanmagan candidate va commit metadata avval `/state` ga fsync qilinadi. `/state` hostdagi `/opt/davomat/state` ga bind mount. Bu GitHub o‘rnidagi yangi primary emas, tiklash jurnali; GitHub hamon asosiy saqlash joyi.
- Noma’lum mahalliy o‘zgarishlar yoki nonempty WAL aniqlansa overwrite qilinmaydi; review xatosi qaytariladi. Callback xatosi snapshotni rollback qiladi. Post-commit callback eski AsyncLocalStorage konteksti bilan qulfni chetlab o‘ta olmaydi.
- `$disconnect()` rejection bo‘lsa release nested finally ichida ishlaydi. Bekor qilish API'si yo‘q Prisma disconnect 20 soniya davomida tugamasa, himoya watchdog'i process'ni tugatadi; tugamagan ish ustidan Promise.race bilan qulf bo‘shatilmaydi. Bu odatiy ish rejimi yoki asosiy tuzatish o‘rnidagi restart emas.

## Navbatlar va ilova

- `queue-runtime.ts`: durable claim/lease, aborted Telegram request, timeout timer cleanup, retry_after, per-job isolation va shutdown drain.
- Announcement, attendance, access notice va reminder yuborish umumiy database lock'dan tashqarida. Attendance text/photo album progressi va admin Telegram message ID'lari bitta GitHub commit'ida saqlanadi. 400 source/content xatosi barcha odamlar bloklangan deb talqin qilinmaydi; malformed task alohida holatga olinadi.
- Reminder 08:20 Asia/Tashkent; kun/o‘qituvchi bo‘yicha idempotent queue. O‘chirish faqat developer uchun. 08:30 dan keyin eski reminder yuborilmaydi.
- API javobi GitHub tasdiqlamaguncha chiqarilmaydi. HTTP 4xx callback oxirigacha qisman yozilgan o‘zgarishni commit qilmaydi. Noaniq natija operation ID bilan qaytadi; UI/bot takroriy yozishga undamay, holatni yangilashni aytadi.
- Telegram reply xatosi qabul qilingan saqlashni GitHub xatosiga aylantirmaydi. Qisqa, maxfiy ma’lumotsiz DAVOMAT_DIAG kodlari manbada.
- Autentifikatsiya bazaga murojaatdan oldin tekshiriladi. TMA uchun HMAC timing-safe taqqoslash, duplicate field / noto‘g‘ri ID / kelajak sanasi / 24 soatdan eski auth_date rad etiladi. Admin/o‘qituvchi rollari bazada tekshiriladi. ADMIN_CHAT_ID avtomatik admin vakolati bermaydi. Standart admin123 fallback olib tashlandi; login urinishlari chegaralandi.
- Internal bot endpoint'lari token bilan himoyalandi. Rasmlar yuklash va QR/ZIP yuborish commit fazasidan ajratildi; media muvaffaqiyatli yuklangach, ruxsat yana tekshiriladi va DB reference saqlanadi. Frontend tarmoq/HTML xatolarida tushunarli xabar oladi.
- `/health` arzon storage holati; `/ready` storage + bot ishlashini tekshiradi. Health probe GitHub download/PUT qilmaydi. Cold start'da proxy bot/DB tayyorligini kutib butun saytni yashirmaydi. SIGTERM'da navbatlar va commitlar drain qilinadi.

## Test dalillari

Barcha tashqi Telegram yuborishlari mock bo‘lgan; haqiqiy foydalanuvchiga test e’loni yuborilmadi. Test SQLite'lari faqat sintetik odamlar va guruhlardan tuzildi. Production `dev.db` ga test yozuvi qo‘shilmadi.

- Windows: 18 storage testi o‘tdi.
- Linux: 19 storage testidan 17 o‘tdi, 2 Windows-only test skip; Linux kernel crash/lock testi alohida o‘tdi.
- 23 worker/QR/reminder testi o‘tdi: slow Telegram vaqtida DB bo‘shligi, claim concurrency, restart cursor, 429 retry_after, blocked recipient, broken job, announcement progress va noto‘g‘ri 400 talqini, developer controls va aniq eslatma matni.
- 10 backend integration ssenariyi yangi image'ning o‘zida o‘tdi: auth, expired/forged TMA, rollar, commit/re-read, invalid mutation rollback, lost HTTP PUT response, noaniq commit tiklanishi, read-only health, internal auth.
- Alohida GitHub `.audit/storage-probe-...txt` faylida haqiqiy PUT/GET huquqi tekshirildi va test fayli o‘chirildi. `dev.db` o‘zgartirilmadi.
- New image full-stack canary: backend /health, /ready, admin va teacher HTML — 200. Rollback image ham alohida network-none canary'da 200 qaytardi.
- Deploy config `--check` va haqiqiy lock/snapshot bilan `--checkpoint-check` ishga tushirildi. Skriptdagi tmpfs'ga docker cp xatosi dry-run'da topilib, docker exec orqali yozishga tuzatildi.

Server dalillari: `/opt/davomat/audit-20261026/evidence/` — `worker-tests.log`, `final-runtime-tests.log`, `storage-tests-linux.log`, `final-image-integration.log`, `final-image-worker-tests.log`, rollback build log va Caddy/Provveb oldin/keyin identifikatorlari.

## Zaxiralar va deploydan keyingi holat

- Birinchi zaxiralar: `/opt/davomat/audit-20261026/backups/local.sqlite`, `github.sqlite`, `live-raw.sqlite`, `restore-verified.sqlite`. Integrity_check va alohida restore muvaffaqiyatli; mahalliy va GitHub nusxalari mazmunan mos.
- Yakuniy cutover: `/opt/davomat/audit-20261026/backups/cutover-20261026T080312-368696/` — SQLite backup, GitHub raw nusxa va SHA/count metadata. Kesish paytida barcha yuborish navbatlari bo‘shligi tekshirildi; umumiy qulf checkpoint va almashtirish orasida ushlab turildi.
- Post-deploy: `/opt/davomat/audit-20261026/backups/post-deploy/verified.sqlite`, integrity_check `ok`; barcha jadval mazmuni cutover nusxasi bilan aynan mos.
- 5 admin, 30 o‘qituvchi, 25 guruh, 518 o‘quvchi, 42 davomat sessiyasi, 1182 yozuv; pending delivery yo‘q. GitHub blob SHA `ca3d011467d77855a2919f619dad2f0987496a57`, 745472 byte.
- `/ready`: storage github, bot running. Image healthy, restartCount 0. Davomat va Provveb HTTPS 200, CS mavjud redirect 302. Caddy va Provveb konteynerlari qayta ishga tushirilmadi.

## Deploy va rollback

Tekshirilgan release'ni qayta deploy tekshirish:

```sh
bash /opt/davomat/releases/20261026-audit/deploy/audit-20261026/deploy.sh --check
```

Rollback:

```sh
bash /opt/davomat/rollback-audit-20261026.sh
```

Bu `davomat:rollback-20261026-live` image'iga faqat app'ni almashtiradi. Unda oldingi runtime announcement hotfix va diagnostika bor. Baza eski zaxiraga qaytarilmaydi: GitHub'dagi hozirgi ma’lumotlar saqlanadi. Oldin yana lock, navbatlar va izchil backup tekshiriladi. Pending journal bo‘lsa rollback avtomatik davom etmaydi — avval yarashtirish yoki qo‘lda review kerak. Legacy rollback health'i faqat eski /health imkoniyati bilan cheklangan.

`/opt/davomat/build-runtime.sh` endi bot flag'ini 1 ga o‘zgartirmaydi va Caddy'ni recreate qilmaydi. U faqat tasdiqlangan image/source SHA bilan ushbu deploy yo‘liga yo‘naltiradi. Yangi kod uchun avval image build, test, canary va yangi tasdiqlash markerlari zarur. Caddyfile symlink'i eski fizik bind-mounted faylga saqlangan; shared config o‘zgartirilmagan.

## Qolgan cheklovlar

- Telegram yuborishi va GitHub commit'i bitta atomik tranzaksiya emas. Telegram qabul qilib, progress saqlanmasdan jarayon uzilsa, ayniqsa uzoq storage xatosida, takroriy yetkazilish ehtimoli qoladi. Lease/progress/reconciliation xavfni kamaytiradi; exactly-once kafolati berilmaydi.
- Worker process crash'dan so‘ng hali tugamagan lease 10 daqiqagacha kutishi mumkin. In-flight lease yoshiga qarab kernel lock o‘chirilmaydi.
- Telegram javobiga bog‘liq xato turiga qarab ayrim vazifalar INVALID/PARTIAL/WAITING_START holatiga olinadi; operator tekshiruvi yoki foydalanuvchining /start'i kerak bo‘lishi mumkin.
- GitHub butun SQLite faylini saqlaydi; tezlik, rate limit va tashqi yozuvchining konflikti shu arxitektura cheklovi. Konfliktda avtomatik merge yo‘q, candidate saqlanadi va yozish tasdiqlanmaydi. GitHub ishlamasa, yangi saqlash muvaffaqiyatli deb ko‘rsatilmaydi.
- Pending/rejected/orphan nusxalari va backup'lar host diskida maxfiy saqlanadi. Disk va diagnostika kodlarini kuzatish hamda operator retention siyosati kerak. Ushbu VPS nusxalari mustaqil off-site backup xizmati emas.
- Rasm fayli yuklanib DB commit rad etilsa, bog‘lanmagan media qolishi mumkin; eski rasmni oldindan o‘chirishdan xavfsizroq. Tozalash alohida tasdiqlangan ish bo‘lishi kerak.
- 08:20 da cron ishlamagan bo‘lsa (butun servis o‘sha vaqtda o‘chiq), bu versiya o‘tgan cron'ni o‘z-o‘zidan qayta yaratmaydi. Yaratilgan reminder queue esa restartdan tiklanadi va 08:30 dan keyin eskiradi.
- Maxsus production admin login/real Mini App'ga foydalanuvchi sifatida kirmadim; ruxsat va yozish oqimlari sintetik canary'da, live health/bot/DB esa serverdan tekshirildi.

## O‘zgargan asosiy fayllar

- `packages/db/github-store.cjs`, `packages/db/index.d.ts`, `packages/shared/src/telegram.ts`.
- `apps/bot/src/bot.ts`, `index.ts`, `services/queue-runtime.ts`, `notify.service.ts`, `access-notice.service.ts`, `access-menu.service.ts`, `reminder.service.ts`, `cron/reminder.cron.ts`.
- `apps/bot/src/handlers/announcement.handler.ts`, `group.handler.ts`, `owner.handler.ts`.
- `apps/backend/src/index.ts`, `deferred-response.ts`, `services/media-upload.service.ts`, `github.service.ts`, `attendance.service.ts`.
- `apps/backend/src/controllers/attendance.controller.ts`, `group.controller.ts`, `teacher.controller.ts`; `routes/auth.routes.ts`, `attendance.routes.ts`, `student.routes.ts`; `middlewares/role.middleware.ts`.
- `apps/admin-panel/src/api.ts`, `apps/teacher-app/src/api.ts`, `start-production.cjs`, `docker-compose.production.yml`, `Dockerfile.audit`.
- `tests/storage-audit.test.cjs`, `queue-audit.test.cjs`, `backend-integration.cjs`; bot reminder va backend QR regression testlari; `deploy/audit-20261026/` deploy/checkpoint/rollback skriptlari.

Mahalliy asosiy loyiha manbalari ham shu tekshirilgan kod bilan yangilandi. Oldingi mahalliy manbalar `audit-20261026/evidence/local-source-before-audit.tar.gz` ichida saqlandi. Hech qanday `.env` o‘zgartirilmadi va kompyuterdagi bot ishga tushirilmadi.