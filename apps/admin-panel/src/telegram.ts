// Use the official locally served bridge; importing SDK 7's runtime overwrites its fullscreen API.
import type TelegramWebApp from '@twa-dev/sdk';
const WebApp = (window as any).Telegram.WebApp as typeof TelegramWebApp;
export default WebApp;
