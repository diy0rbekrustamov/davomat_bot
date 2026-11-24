"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("express-async-errors"); // Async xatolarni tutish uchun
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const routes_1 = __importDefault(require("./routes"));
const http_error_1 = require("./http-error");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@davomat/db");
const telegram_auth_middleware_1 = require("./middlewares/telegram-auth.middleware");
// BigInt ni JSON.stringify da string qilish uchun patch
BigInt.prototype.toJSON = function () {
    return this.toString();
};
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
// Qr kodlarni external olish uchun statik fayl sifatida xizmat qilish
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.get('/health', async (req, res) => { try {
    if (!(0, db_1.githubPrimary)()) {
        await db_1.prisma.telegramChat.count({ where: { active: true } });
    }
    res.json({ status: 'ok', storage: (0, db_1.githubPrimary)() ? 'github' : 'local' });
}
catch {
    res.status(503).json({ status: 'database_unavailable' });
} });
// Buffer the HTTP response until GitHub has accepted all database changes.
app.use('/api', async (req, res, next) => {
    if (!(0, db_1.githubPrimary)())
        return next();
    const end = res.end.bind(res), write = res.write.bind(res);
    const chunks = [];
    try {
        await (0, db_1.withGithubDatabase)(() => new Promise(resolve => {
            res.write = (chunk) => { if (chunk)
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return true; };
            res.end = (chunk) => { if (chunk)
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); resolve(); return res; };
            next();
        }));
        res.end = end;
        res.write = write;
        end(Buffer.concat(chunks));
    }
    catch (error) {
        res.end = end;
        res.write = write;
        res.removeHeader('Content-Length');
        res.status(503).json({ message: 'GitHub bilan bog‘lanib bo‘lmadi. O‘zgarish saqlangani tasdiqlanmadi; qayta urinib ko‘ring.' });
    }
});
// Windows App (yoki boshqa tashqi klientlar) uchun ochiq login tizimi
app.use('/api/auth', auth_routes_1.default);
// Barcha /api route'lari (yuqoridagi /api/auth dan tashqari) avtorizatsiya talab qiladi
// Middleware ichida JWT va Telegram TMA tokenlari qabul qilinadi
app.use('/api', telegram_auth_middleware_1.telegramAuthMiddleware, routes_1.default);
app.post('/internal/sync-database', async (req, res) => {
    const supplied = req.headers['x-internal-token'];
    const expected = process.env.BOT_TOKEN;
    if (typeof supplied !== 'string' || !expected || supplied.length !== expected.length || !crypto_1.default.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
        return res.sendStatus(403);
    if (!(0, db_1.githubPrimary)())
        github_service_1.githubService.scheduleDatabaseBackup();
    res.json({ queued: !(0, db_1.githubPrimary)(), storage: (0, db_1.githubPrimary)() ? 'github' : 'local' });
});
// Global xatolik tutuvchi (Error Handler)
app.use((err, req, res, next) => {
    console.error('Server error:', err.code || err.status || 'request');
    if (err instanceof http_error_1.HttpError)
        return res.status(err.status).json({ message: err.message });
    if (err instanceof zod_1.ZodError)
        return res.status(400).json({ message: err.issues.map(i => i.message).join('; ') });
    if (err instanceof Error) {
        return res.status(500).json({ message: 'Serverda xatolik. Keyinroq urinib ko‘ring.' });
    }
    res.status(500).json({ message: 'Noma`lum server xatoligi' });
});
const github_service_1 = require("./services/github.service");
const PORT = process.env.PORT || 3000;
async function bootstrap() {
    if ((0, db_1.githubPrimary)())
        await (0, db_1.storageHealth)();
    else {
        await github_service_1.githubService.pullDatabase();
        github_service_1.githubService.startPeriodicBackup();
    }
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
bootstrap();
