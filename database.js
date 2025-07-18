import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'game.db'));

// Создание таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    coins INTEGER DEFAULT 500,
    energy INTEGER DEFAULT 1000,
    max_energy INTEGER DEFAULT 1000,
    level INTEGER DEFAULT 1,
    coins_per_click INTEGER DEFAULT 1,
    total_clicks INTEGER DEFAULT 0,
    energy_regen_rate INTEGER DEFAULT 1,
    last_energy_update INTEGER DEFAULT 0,
    daily_bonus_last_claim INTEGER DEFAULT 0,
    completed_tasks TEXT DEFAULT '[]',
    upgrade_click_power INTEGER DEFAULT 0,
    upgrade_energy_capacity INTEGER DEFAULT 0,
    upgrade_energy_regen INTEGER DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by INTEGER,
    referral_earnings INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL,
    reward_claimed INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (referrer_id) REFERENCES users (telegram_id),
    FOREIGN KEY (referred_id) REFERENCES users (telegram_id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins DESC);
  CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
`);

// Генерация уникального реферального кода
function generateReferralCode(telegramId) {
  return `REF${telegramId}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

// Получение или создание пользователя
export function getOrCreateUser(telegramId, userData = {}) {
  let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  
  if (!user) {
    const referralCode = generateReferralCode(telegramId);
    const insertUser = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, referral_code, last_energy_update)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertUser.run(
      telegramId,
      userData.username || null,
      userData.first_name || null,
      referralCode,
      Date.now()
    );
    
    user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  }
  
  return user;
}

// Обновление данных пользователя
export function updateUser(telegramId, gameState) {
  const updateStmt = db.prepare(`
    UPDATE users SET
      coins = ?,
      energy = ?,
      max_energy = ?,
      level = ?,
      coins_per_click = ?,
      total_clicks = ?,
      energy_regen_rate = ?,
      last_energy_update = ?,
      daily_bonus_last_claim = ?,
      completed_tasks = ?,
      upgrade_click_power = ?,
      upgrade_energy_capacity = ?,
      upgrade_energy_regen = ?
    WHERE telegram_id = ?
  `);
  
  return updateStmt.run(
    gameState.coins,
    gameState.energy,
    gameState.maxEnergy,
    gameState.level,
    gameState.coinsPerClick,
    gameState.totalClicks,
    gameState.energyRegenRate,
    gameState.lastEnergyUpdate,
    gameState.dailyBonusLastClaim,
    JSON.stringify(gameState.completedTasks),
    gameState.upgrades.clickPower,
    gameState.upgrades.energyCapacity,
    gameState.upgrades.energyRegen,
    telegramId
  );
}

// Получение таблицы лидеров
export function getLeaderboard(limit = 50) {
  return db.prepare(`
    SELECT 
      telegram_id,
      username,
      first_name,
      coins,
      level,
      total_clicks,
      ROW_NUMBER() OVER (ORDER BY coins DESC) as rank
    FROM users 
    ORDER BY coins DESC 
    LIMIT ?
  `).all(limit);
}

// Обработка реферала
export function processReferral(referrerCode, newUserId) {
  const referrer = db.prepare('SELECT * FROM users WHERE referral_code = ?').get(referrerCode);
  
  if (!referrer || referrer.telegram_id === newUserId) {
    return null;
  }
  
  // Проверяем, не был ли уже этот пользователь приглашен
  const existingReferral = db.prepare('SELECT * FROM referrals WHERE referred_id = ?').get(newUserId);
  if (existingReferral) {
    return null;
  }
  
  const transaction = db.transaction(() => {
    // Добавляем запись о реферале
    db.prepare(`
      INSERT INTO referrals (referrer_id, referred_id)
      VALUES (?, ?)
    `).run(referrer.telegram_id, newUserId);
    
    // Обновляем информацию о том, кто пригласил нового пользователя
    db.prepare('UPDATE users SET referred_by = ? WHERE telegram_id = ?')
      .run(referrer.telegram_id, newUserId);
    
    // Начисляем бонус пригласившему (1000 монет)
    db.prepare(`
      UPDATE users SET 
        coins = coins + 1000,
        referral_earnings = referral_earnings + 1000
      WHERE telegram_id = ?
    `).run(referrer.telegram_id);
    
    // Бонус новому пользователю (500 дополнительных монет)
    db.prepare('UPDATE users SET coins = coins + 500 WHERE telegram_id = ?')
      .run(newUserId);
  });
  
  transaction();
  return referrer;
}

// Получение статистики рефералов
export function getReferralStats(telegramId) {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_referrals,
      COALESCE(SUM(1000), 0) as total_earnings
    FROM referrals 
    WHERE referrer_id = ?
  `).get(telegramId);
  
  const referrals = db.prepare(`
    SELECT 
      u.first_name,
      u.username,
      u.coins,
      r.created_at
    FROM referrals r
    JOIN users u ON r.referred_id = u.telegram_id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
  `).all(telegramId);
  
  return { ...stats, referrals };
}

export default db;