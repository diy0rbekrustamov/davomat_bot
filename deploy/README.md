# Davomat — Contabo production

- Manzil: https://davomat.provveb.uz
- O‘qituvchi ilovasi: https://davomat.provveb.uz/teacher/
- Bot: https://t.me/bst_davomat_bot
- VPS: `164.68.102.68`, Ubuntu 24.04 LTS, vaqt mintaqasi `Asia/Tashkent`.
- Joriy release: `/opt/davomat/current` → `/opt/davomat/releases/20261024`.
- Maxfiy sozlamalar: `/opt/davomat/secrets/runtime.env` (root, `0600`). Ularni Git yoki Docker obraziga qo‘shmang.
- Ishga tushirish sozlamasi: `/opt/davomat/server.env`, `DAVOMAT_DISABLE_BOT=0`.

## Ishlash tartibi

Docker xizmati avtomatik boshlanadi; ilova va Caddy konteynerlarida `restart: unless-stopped` o‘rnatilgan. Caddy HTTPS sertifikatini avtomatik yangilaydi. Tashqariga 22/tcp, 80/tcp, 443/tcp va 443/udp ochiq. Ilovaning 4000-porti faqat `127.0.0.1` ga bog‘langan; backend va bot ichki portlarda ishlaydi.

Baza GitHub’dagi xususiy repozitoriydan `/ram` vaqtinchalik xotirasiga olinadi. RAM nusxasi doimiy saqlash manbasi emas. Ishga tushirishdagi tekshirilgan zaxira: `/opt/davomat/backups/deployment-20261024.db` (`0600`, SQLite `quick_check: ok`). GitHub runtime tokeni va internet ulanishi baza uchun zarur.

Eslatma har kuni **08:20 Asia/Tashkent** da ishlaydi. Uni boshqarish tugmalari faqat developerga ko‘rinadi. Guruhlar sahifasida A4 QR rasmlarini guruh nomlari bilan ZIP qilib olish mavjud.

## Holat va yangilash

Serverda:

```sh
cd /opt/davomat/current
docker compose --env-file /opt/davomat/server.env -p davomat -f docker-compose.production.yml ps
docker compose --env-file /opt/davomat/server.env -p davomat -f docker-compose.production.yml logs --tail 100
```

Manba yangilangach, maxfiy sozlamalarni saqlagan holda:

```sh
cd /opt/davomat/current
docker compose --env-file /opt/davomat/server.env -p davomat -f docker-compose.production.yml up -d --build
curl -f https://davomat.provveb.uz/
```

Mahalliy kompyuterdagi eski botni parallel yoqmang: Telegram polling uchun bitta faol nusxa ishlashi kerak.

## 2026-10-24 tekshiruvlari

HTTPS va admin/o‘qituvchi sahifalari, admin login, guruh/o‘qituvchi API, Telegram getMe va polling holati, jonli GitHub/SQLite o‘qilishi hamda zaxira yaxlitligi tekshirildi. Production obrazida tarmoqsiz 13 ta test o‘tdi: eslatma va developer huquqlari, ZIP endpointi, xabar worker’i va baza qulfi. Sinovlarda o‘qituvchilarga qo‘lda eslatma yoki ZIP yuborilmadi.
