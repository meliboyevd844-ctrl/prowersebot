import { config } from '../config.js';
console.log('TELEGRAM_BOT_TOKEN:', JSON.stringify(config.telegram.botToken));
console.log('ADMIN_IDS:', config.telegram.adminIds);
console.log('PROVERSE_BASE_URL:', config.proverse.baseUrl);
console.log('PROVERSE_USERNAME:', config.proverse.username);
