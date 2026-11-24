export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}
/**
 * Telegram WebApp initData validatsiyasi.
 * HMAC-SHA256 orqali ma'lumotlarning Telegramdan kelganligini tekshiradi.
 */
export declare function validateTelegramInitData(initData: string, botToken: string): TelegramUser | null;
