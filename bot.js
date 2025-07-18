import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getOrCreateUser, updateUser, getLeaderboard, processReferral, getReferralStats } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL || 'https://your-ngrok-url.ngrok.io';

if (!token) {
  console.error('❌ BOT_TOKEN не найден в .env файле!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// Обработчик команды /start с поддержкой рефералов
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const firstName = msg.from.first_name || 'Игрок';
  const referralParam = match[1] ? match[1].trim() : '';
  
  // Создаем или получаем пользователя
  const user = getOrCreateUser(telegramId, {
    username: msg.from.username,
    first_name: msg.from.first_name
  });
  
  // Обрабатываем реферальный код если есть
  let referralMessage = '';
  if (referralParam && referralParam !== user.referral_code) {
    const referrer = processReferral(referralParam, telegramId);
    if (referrer) {
      referralMessage = `\n🎁 Вы получили бонус 500 монет за переход по реферальной ссылке!`;
      
      // Уведомляем пригласившего
      try {
        await bot.sendMessage(referrer.telegram_id, 
          `🎉 По вашей ссылке зарегистрировался новый игрок!\n💰 Вы получили 1000 монет!`
        );
      } catch (error) {
        console.log('Не удалось отправить уведомление пригласившему:', error.message);
      }
    }
  }
  
  const welcomeMessage = `🌟 Добро пожаловать в NotCoin, ${firstName}!${referralMessage}

💎 Зарабатывайте монеты кликами
⚡ Следите за энергией  
📈 Повышайте уровень
🛒 Покупайте улучшения
🏆 Выполняйте задания
👥 Приглашайте друзей

Нажмите кнопку ниже, чтобы начать играть!`;

  const keyboard = {
    inline_keyboard: [[
      {
        text: '🎮 Играть в NotCoin',
        web_app: { url: webAppUrl }
      }
    ]]
  };

  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: keyboard,
    parse_mode: 'HTML'
  });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `📖 <b>Как играть в NotCoin:</b>

🎯 <b>Основы игры:</b>
• Кликайте по монете для заработка
• Каждый клик тратит 1 энергию
• Энергия восстанавливается автоматически

📈 <b>Прогресс:</b>
• Зарабатывайте монеты для повышения уровня
• Выше уровень = больше бонусов

🛒 <b>Улучшения:</b>
• Сила клика - больше монет за клик
• Вместимость энергии - больше максимальной энергии
• Восстановление энергии - быстрее восстановление

🏆 <b>Задания:</b>
• Выполняйте задания для получения наград
• Получайте ежедневные бонусы

👥 <b>Рефералы:</b>
• Приглашайте друзей и получайте 1000 монет
• Ваши друзья получают 500 бонусных монет

Удачной игры! 🎮`;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  
  const user = getOrCreateUser(telegramId);
  const referralStats = getReferralStats(telegramId);
  
  const statsMessage = `📊 <b>Ваша статистика:</b>

💰 Монеты: ${user.coins.toLocaleString()}
📈 Уровень: ${user.level}
🎯 Всего кликов: ${user.total_clicks.toLocaleString()}
👥 Приглашено друзей: ${referralStats.total_referrals}
💎 Заработано с рефералов: ${referralStats.total_earnings.toLocaleString()}

Откройте игру для подробной статистики!`;

  bot.sendMessage(chatId, statsMessage, { parse_mode: 'HTML' });
});

bot.onText(/\/leaderboard/, (msg) => {
  const chatId = msg.chat.id;
  
  const leaderboard = getLeaderboard(10);
  let message = '🏆 <b>Таблица лидеров:</b>\n\n';
  
  leaderboard.forEach((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const name = user.first_name || user.username || 'Аноним';
    message += `${medal} ${name} - ${user.coins.toLocaleString()} монет\n`;
  });
  
  bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});

// Обработка данных из Web App
bot.on('web_app_data', (msg) => {
  const chatId = msg.chat.id;
  const data = JSON.parse(msg.web_app.data);
  
  console.log('Получены данные из Web App:', data);
  
  if (data.type === 'game_result') {
    const { coins, level, clicks } = data;
    
    const resultMessage = `🎉 <b>Отличная игра!</b>

💰 Монет заработано: ${coins.toLocaleString()}
📈 Уровень: ${level}
🎯 Всего кликов: ${clicks.toLocaleString()}

Продолжайте играть для достижения новых высот! 🚀`;

    bot.sendMessage(chatId, resultMessage, { parse_mode: 'HTML' });
  }
});

// API эндпоинты
app.get('/api/user/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = getOrCreateUser(userId);
    
    res.json({
      success: true,
      user: {
        coins: user.coins,
        energy: user.energy,
        maxEnergy: user.max_energy,
        level: user.level,
        coinsPerClick: user.coins_per_click,
        totalClicks: user.total_clicks,
        energyRegenRate: user.energy_regen_rate,
        lastEnergyUpdate: user.last_energy_update,
        dailyBonusLastClaim: user.daily_bonus_last_claim,
        completedTasks: JSON.parse(user.completed_tasks || '[]'),
        upgrades: {
          clickPower: user.upgrade_click_power,
          energyCapacity: user.upgrade_energy_capacity,
          energyRegen: user.upgrade_energy_regen
        },
        referralCode: user.referral_code
      }
    });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/save-progress', (req, res) => {
  try {
    const { userId, gameState } = req.body;
    updateUser(parseInt(userId), gameState);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка сохранения прогресса:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const leaderboard = getLeaderboard(50);
    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('Ошибка получения таблицы лидеров:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/referral-stats/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const stats = getReferralStats(userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Ошибка получения статистики рефералов:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обслуживание статических файлов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Web App URL: ${webAppUrl}`);
  console.log(`🤖 Telegram Bot активен`);
  console.log(`💾 База данных SQLite подключена`);
  console.log(`\n📋 Инструкции для настройки:`);
  console.log(`1. Замените BOT_TOKEN в .env на токен вашего бота`);
  console.log(`2. Запустите ngrok: ngrok http ${PORT}`);
  console.log(`3. Обновите WEBAPP_URL в .env на URL от ngrok`);
  console.log(`4. Перезапустите сервер`);
});

// Обработка ошибок
bot.on('error', (error) => {
  console.error('Ошибка Telegram Bot:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  process.exit(1);
});