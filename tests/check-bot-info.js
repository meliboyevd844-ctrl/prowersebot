import { Telegraf } from 'telegraf';
import { config } from '../config.js';

async function checkBot() {
  const bot = new Telegraf(config.telegram.botToken);
  try {
    const me = await bot.telegram.getMe();
    console.log('🤖 BOT MA\'LUMOTLARI:');
    console.log('---------------------------------');
    console.log('ID:', me.id);
    console.log('Ismi (First Name):', me.first_name);
    console.log('Username: @' + me.username);
    console.log('Guruhlarga qo\'shila oladimi (can_join_groups):', me.can_join_groups);
    console.log('Barcha xabarlarni o\'qiy oladimi (can_read_all_group_messages):', me.can_read_all_group_messages);
    console.log('---------------------------------');
  } catch (err) {
    console.error('Xatolik:', err.message);
  }
}

checkBot();
