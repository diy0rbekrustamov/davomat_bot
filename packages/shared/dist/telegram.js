"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTelegramInitData = validateTelegramInitData;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Telegram WebApp initData validatsiyasi.
 * HMAC-SHA256 orqali ma'lumotlarning Telegramdan kelganligini tekshiradi.
 */
function validateTelegramInitData(initData, botToken) {
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        if (!hash)
            return null;
        urlParams.delete('hash');
        // Parametrlarni alifbo tartibida saralash
        const keys = Array.from(urlParams.keys()).sort();
        const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');
        // Secret key yaratish (HMAC-SHA256, kalit = "WebAppData", data = botToken)
        const secretKey = crypto_1.default.createHmac('sha256', 'WebAppData').update(botToken).digest();
        // Xeshni hisoblash
        const calculatedHash = crypto_1.default.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        if (calculatedHash !== hash) {
            return null;
        }
        const userStr = urlParams.get('user');
        if (!userStr)
            return null;
        const user = JSON.parse(userStr);
        return user;
    }
    catch (error) {
        console.error('Telegram initData validatsiya xatosi:', error);
        return null;
    }
}
