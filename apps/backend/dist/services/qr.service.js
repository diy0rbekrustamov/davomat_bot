"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QrService = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
class QrService {
    static UPLOADS_DIR = path_1.default.join(process.cwd(), 'uploads', 'qr');
    /**
     * qrToken asosida QR kod yaratadi va /uploads/qr/ ichida saqlaydi.
     * Yaratilgan rasm manzilini qaytaradi.
     */
    static async generateAndSaveQr(qrToken) {
        if (process.env.GITHUB_PRIMARY === '1') {
            const buffer = await qrcode_1.default.toBuffer(qrToken, { width: 500, margin: 2 });
            const file = 'images/qr/' + qrToken + '.png';
            await require('./github.service').githubService.pushFiles([{ path: file, content: buffer, isBinary: true }], 'Sinf QR kodi');
            return 'https://raw.githubusercontent.com/' + (process.env.GITHUB_REPO || 'provveb/database_davomat_byprovveb') + '/main/' + file;
        }
        // Papka mavjudligini tekshirish va yaratish
        await promises_1.default.mkdir(this.UPLOADS_DIR, { recursive: true });
        const fileName = `${qrToken}.png`;
        const filePath = path_1.default.join(this.UPLOADS_DIR, fileName);
        // QR kod skan qilinganda Mini App ga yo'naltirilishi kerak
        // Hozircha oddiy tekst sifatida token'ni o'zini generatsiya qilamiz
        // yoki Mini App manzili (t.me/your_bot?startapp=scan_${qrToken}) qilib yozsa ham bo'ladi
        const qrData = qrToken;
        await qrcode_1.default.toFile(filePath, qrData, {
            width: 500,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        // Bu yerda nisbiy manzil qaytariladi (API orqali o'qish uchun)
        return `/uploads/qr/${fileName}`;
    }
}
exports.QrService = QrService;
