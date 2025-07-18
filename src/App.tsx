import React, { useState, useEffect, useCallback } from 'react';
import { 
  Coins, 
  Zap, 
  Star, 
  Trophy, 
  Gift, 
  ShoppingCart, 
  Target,
  TrendingUp,
  Award,
  Home,
  Users,
  Crown,
  Copy
} from 'lucide-react';

// Telegram Web App API
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  }
}

interface GameState {
  coins: number;
  energy: number;
  maxEnergy: number;
  level: number;
  coinsPerClick: number;
  totalClicks: number;
  energyRegenRate: number;
  lastEnergyUpdate: number;
  dailyBonusLastClaim: number;
  completedTasks: string[];
  upgrades: {
    clickPower: number;
    energyCapacity: number;
    energyRegen: number;
  };
  referralCode?: string;
}

interface LeaderboardEntry {
  rank: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  coins: number;
  level: number;
  total_clicks: number;
}

interface Task {
  id: string;
  title: string;
  reward: number;
  requirement: number;
  type: 'clicks' | 'level' | 'coins' | 'upgrade_power' | 'upgrade_energy';
}

interface ReferralStats {
  total_referrals: number;
  total_earnings: number;
  referrals?: Array<{
    first_name?: string;
    username?: string;
    coins: number;
  }>;
}

const INITIAL_STATE: GameState = {
  coins: 500,
  energy: 1000,
  maxEnergy: 1000,
  level: 1,
  coinsPerClick: 1,
  totalClicks: 0,
  energyRegenRate: 1,
  lastEnergyUpdate: Date.now(),
  dailyBonusLastClaim: 0,
  completedTasks: [],
  upgrades: {
    clickPower: 0,
    energyCapacity: 0,
    energyRegen: 0
  },
  referralCode: undefined
};

const UPGRADE_COSTS = {
  clickPower: [100, 500, 2000, 10000, 50000],
  energyCapacity: [200, 1000, 5000, 25000, 100000],
  energyRegen: [150, 750, 3000, 15000, 75000]
};

const LEVEL_REQUIREMENTS = [0, 100, 500, 1500, 4000, 10000, 25000, 60000, 150000, 400000];

const TASKS: Task[] = [
  { id: 'clicks_100', title: 'Сделать 100 кликов', reward: 500, requirement: 100, type: 'clicks' },
  { id: 'clicks_500', title: 'Сделать 500 кликов', reward: 2000, requirement: 500, type: 'clicks' },
  { id: 'clicks_1000', title: 'Сделать 1000 кликов', reward: 5000, requirement: 1000, type: 'clicks' },
  { id: 'level_5', title: 'Достичь 5 уровня', reward: 5000, requirement: 5, type: 'level' },
  { id: 'level_10', title: 'Достичь 10 уровня', reward: 15000, requirement: 10, type: 'level' },
  { id: 'coins_10k', title: 'Заработать 10,000 монет', reward: 10000, requirement: 10000, type: 'coins' },
  { id: 'coins_50k', title: 'Заработать 50,000 монет', reward: 25000, requirement: 50000, type: 'coins' },
  { id: 'upgrade_power', title: 'Купить улучшение силы', reward: 1000, requirement: 1, type: 'upgrade_power' },
  { id: 'upgrade_energy', title: 'Купить улучшение энергии', reward: 1500, requirement: 1, type: 'upgrade_energy' },
];

function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [clickAnimation, setClickAnimation] = useState<{ x: number; y: number; id: number; value: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'game' | 'upgrades' | 'tasks' | 'stats' | 'leaderboard' | 'referrals'>('game');
  const [showDailyBonus, setShowDailyBonus] = useState(false);

  const [telegramUser, setTelegramUser] = useState<{
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  } | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      if (tg.initDataUnsafe.user) {
        setTelegramUser(tg.initDataUnsafe.user);
        loadUserData(tg.initDataUnsafe.user.id);
      }
    } else {
      // Симуляция загрузки для тестирования без Telegram
      setTimeout(() => {
        setIsLoading(false);
        // Генерируем реферальный код
        setGameState(prev => ({
          ...prev,
          referralCode: `ref_${Math.random().toString(36).substring(2, 8)}`
        }));
      }, 1000);
    }
  }, []);

  // Заглушка для загрузки данных пользователя
  const loadUserData = async (userId: number) => {
    try {
      // Симуляция API запроса
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Загружаем данные из localStorage или используем дефолтные
      const savedData = localStorage.getItem(`gameState_${userId}`);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setGameState({
          ...parsed,
          lastEnergyUpdate: Date.now(),
          referralCode: parsed.referralCode || `ref_${userId}_${Math.random().toString(36).substring(2, 8)}`
        });
      } else {
        setGameState(prev => ({
          ...prev,
          referralCode: `ref_${userId}_${Math.random().toString(36).substring(2, 8)}`
        }));
      }
    } catch (error) {
      console.error('Ошибка загрузки данных пользователя:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Сохранение прогресса
  const saveProgress = useCallback(async (newGameState: GameState) => {
    if (!telegramUser) {
      // Сохраняем в localStorage если нет Telegram пользователя
      localStorage.setItem('gameState_demo', JSON.stringify(newGameState));
      return;
    }
    
    try {
      // Сохраняем в localStorage
      localStorage.setItem(`gameState_${telegramUser.id}`, JSON.stringify(newGameState));
      
      // Здесь можно добавить реальный API запрос
      // await fetch('/api/save-progress', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ userId: telegramUser.id, gameState: newGameState })
      // });
    } catch (error) {
      console.error('Ошибка сохранения прогресса:', error);
    }
  }, [telegramUser]);

  // Заглушка для загрузки таблицы лидеров
  const loadLeaderboard = async () => {
    try {
      // Симуляция API запроса
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Генерируем фейковых лидеров
      const mockLeaderboard: LeaderboardEntry[] = [
        { rank: 1, telegram_id: 123456789, first_name: 'Алексей', coins: 1500000, level: 15, total_clicks: 25000 },
        { rank: 2, telegram_id: 987654321, first_name: 'Мария', coins: 1200000, level: 12, total_clicks: 20000 },
        { rank: 3, telegram_id: 555666777, first_name: 'Дмитрий', coins: 800000, level: 10, total_clicks: 15000 },
        { rank: 4, telegram_id: 111222333, first_name: 'Анна', coins: 600000, level: 8, total_clicks: 12000 },
        { rank: 5, telegram_id: 444555666, first_name: 'Игорь', coins: 400000, level: 6, total_clicks: 8000 },
      ];
      
      // Добавляем текущего пользователя если он есть
      if (telegramUser) {
        const userEntry: LeaderboardEntry = {
          rank: 6,
          telegram_id: telegramUser.id,
          first_name: telegramUser.first_name,
          username: telegramUser.username,
          coins: gameState.coins,
          level: gameState.level,
          total_clicks: gameState.totalClicks
        };
        mockLeaderboard.push(userEntry);
      }
      
      setLeaderboard(mockLeaderboard);
    } catch (error) {
      console.error('Ошибка загрузки таблицы лидеров:', error);
    }
  };

  // Заглушка для загрузки статистики рефералов
  const loadReferralStats = async () => {
    if (!telegramUser) return;
    
    try {
      // Симуляция API запроса
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Генерируем фейковую статистику
      const mockStats: ReferralStats = {
        total_referrals: 3,
        total_earnings: 3000,
        referrals: [
          { first_name: 'Иван', coins: 5000 },
          { first_name: 'Елена', coins: 3000 },
          { username: 'user123', coins: 1500 }
        ]
      };
      
      setReferralStats(mockStats);
    } catch (error) {
      console.error('Ошибка загрузки статистики рефералов:', error);
    }
  };

  // Восстановление энергии
  useEffect(() => {
    const interval = setInterval(() => {
      setGameState(prev => {
        const now = Date.now();
        const timePassed = now - prev.lastEnergyUpdate;
        const energyToAdd = Math.floor(timePassed / 1000) * prev.energyRegenRate;
        
        if (energyToAdd > 0) {
          const newState = {
            ...prev,
            energy: Math.min(prev.maxEnergy, prev.energy + energyToAdd),
            lastEnergyUpdate: now
          };
          
          // Сохраняем только если энергия изменилась значительно
          if (energyToAdd >= 10) {
            saveProgress(newState);
          }
          
          return newState;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [saveProgress]);

  // Проверка ежедневного бонуса
  useEffect(() => {
    const now = Date.now();
    const lastClaim = gameState.dailyBonusLastClaim;
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    if (now - lastClaim >= oneDayMs) {
      setShowDailyBonus(true);
    }
  }, [gameState.dailyBonusLastClaim]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (gameState.energy < 1) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setGameState(prev => {
      const newCoins = prev.coins + prev.coinsPerClick;
      const newTotalClicks = prev.totalClicks + 1;
      const newLevel = Math.min(LEVEL_REQUIREMENTS.length - 1, 
        LEVEL_REQUIREMENTS.findIndex(req => newCoins < req) - 1);

      const newState = {
        ...prev,
        coins: newCoins,
        energy: prev.energy - 1,
        totalClicks: newTotalClicks,
        level: newLevel === -1 ? LEVEL_REQUIREMENTS.length - 1 : newLevel,
        lastEnergyUpdate: Date.now()
      };

      // Сохраняем каждые 10 кликов
      if (newTotalClicks % 10 === 0) {
        saveProgress(newState);
      }

      return newState;
    });

    // Добавляем анимацию клика
    const animationId = Date.now() + Math.random();
    setClickAnimation(prev => [...prev, { x, y, id: animationId, value: gameState.coinsPerClick }]);
    
    setTimeout(() => {
      setClickAnimation(prev => prev.filter(item => item.id !== animationId));
    }, 1000);
  }, [gameState.energy, gameState.coinsPerClick, saveProgress]);

  const buyUpgrade = (type: keyof typeof UPGRADE_COSTS) => {
    const currentLevel = gameState.upgrades[type];
    if (currentLevel >= UPGRADE_COSTS[type].length) return;
    
    const cost = UPGRADE_COSTS[type][currentLevel];
    if (gameState.coins < cost) return;

    setGameState(prev => {
      const newState = {
        ...prev,
        coins: prev.coins - cost,
        upgrades: {
          ...prev.upgrades,
          [type]: prev.upgrades[type] + 1
        },
        coinsPerClick: type === 'clickPower' ? prev.coinsPerClick + 1 : prev.coinsPerClick,
        maxEnergy: type === 'energyCapacity' ? prev.maxEnergy + 200 : prev.maxEnergy,
        energyRegenRate: type === 'energyRegen' ? prev.energyRegenRate + 1 : prev.energyRegenRate
      };
      
      saveProgress(newState);
      return newState;
    });
  };

  const claimDailyBonus = () => {
    const bonusAmount = 1000 * gameState.level;
    setGameState(prev => {
      const newState = {
        ...prev,
        coins: prev.coins + bonusAmount,
        dailyBonusLastClaim: Date.now()
      };
      
      saveProgress(newState);
      return newState;
    });
    setShowDailyBonus(false);
  };

  const completeTask = (taskId: string, reward: number) => {
    setGameState(prev => {
      const newState = {
        ...prev,
        coins: prev.coins + reward,
        completedTasks: [...prev.completedTasks, taskId]
      };
      
      saveProgress(newState);
      return newState;
    });
  };

  const sendDataToTelegram = () => {
    if (window.Telegram?.WebApp) {
      const data = {
        type: 'game_result',
        coins: gameState.coins,
        level: gameState.level,
        clicks: gameState.totalClicks,
        userId: telegramUser?.id
      };
      
      window.Telegram.WebApp.sendData(JSON.stringify(data));
    }
  };

  const copyReferralLink = () => {
    if (!gameState.referralCode) return;
    
    const botUsername = 'mirzagame_bot'; // Замените на username вашего бота
    const referralLink = `https://t.me/${botUsername}?start=${gameState.referralCode}`;
    
    navigator.clipboard.writeText(referralLink).then(() => {
      alert('Реферальная ссылка скопирована!');
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}М`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}К`;
    return num.toString();
  };

  const getTaskProgress = (task: Task): number => {
    switch (task.type) {
      case 'clicks':
        return gameState.totalClicks;
      case 'level':
        return gameState.level;
      case 'coins':
        return gameState.coins;
      case 'upgrade_power':
        return gameState.upgrades.clickPower;
      case 'upgrade_energy':
        return gameState.upgrades.energyCapacity;
      default:
        return 0;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-400 border-t-transparent mx-auto mb-4"></div>
          <div className="text-cyan-400 text-xl font-bold">Загрузка...</div>
        </div>
      </div>
    );
  }

  const GameScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      {/* Заголовок */}
      <div className="w-full max-w-md mb-6">
        {/* Приветствие пользователя */}
        {telegramUser && (
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-3 mb-4 border border-cyan-400/30 shadow-lg shadow-cyan-400/20">
            <div className="text-center">
              <div className="text-cyan-400 text-sm font-medium">Привет, {telegramUser.first_name}! 👋</div>
            </div>
          </div>
        )}
        
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-yellow-400/30 shadow-lg shadow-yellow-400/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Coins className="text-yellow-400 drop-shadow-lg" size={24} />
              <span className="text-yellow-400 text-xl font-bold drop-shadow-lg">{formatNumber(gameState.coins)}</span>
            </div>
            <div className="text-cyan-400 text-sm font-medium">Уровень {gameState.level}</div>
          </div>
        </div>

        {/* Полоса энергии */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-green-400/30 shadow-lg shadow-green-400/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Zap className="text-green-400 drop-shadow-lg" size={20} />
              <span className="text-green-400 text-sm font-medium">Энергия</span>
            </div>
            <span className="text-green-400 text-sm font-medium">{gameState.energy}/{gameState.maxEnergy}</span>
          </div>
          <div className="w-full bg-black/40 rounded-full h-3 border border-green-400/20">
            <div 
              className="bg-gradient-to-r from-green-400 to-cyan-400 h-3 rounded-full transition-all duration-300 shadow-lg shadow-green-400/30"
              style={{ width: `${(gameState.energy / gameState.maxEnergy) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Основная кнопка клика */}
      <div className="relative mb-6">
        <button
          onClick={handleClick}
          disabled={gameState.energy < 1}
          className={`w-48 h-48 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 
            shadow-2xl transform transition-all duration-200 
            ${gameState.energy >= 1 ? 'hover:scale-105 active:scale-95 shadow-yellow-400/50' : 'opacity-50 cursor-not-allowed'}
            border-4 border-yellow-300/50 flex items-center justify-center
            animate-pulse`}
          style={{
            boxShadow: gameState.energy >= 1 ? '0 0 50px rgba(251, 191, 36, 0.6), 0 0 100px rgba(251, 191, 36, 0.3)' : 'none'
          }}
        >
          <Coins size={80} className="text-white drop-shadow-2xl" />
        </button>

        {/* Анимация кликов */}
        {clickAnimation.map(({ x, y, id, value }) => (
          <div
            key={id}
            className="absolute text-yellow-300 font-bold text-2xl pointer-events-none animate-bounce"
            style={{ 
              left: x - 20, 
              top: y - 20,
              textShadow: '0 0 10px rgba(251, 191, 36, 0.8)'
            }}
          >
            +{value}
          </div>
        ))}
      </div>

      {/* Информация о клике */}
      <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 mb-6 w-full max-w-md border border-orange-400/30 shadow-lg shadow-orange-400/20">
        <div className="text-center">
          <div className="text-orange-400 text-sm mb-1 font-medium">За клик</div>
          <div className="text-orange-400 text-xl font-bold drop-shadow-lg">{gameState.coinsPerClick} монет</div>
        </div>
      </div>

      {/* Кнопка отправки результатов в Telegram */}
      {window.Telegram?.WebApp && (
        <button
          onClick={sendDataToTelegram}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold mb-4 transition-all shadow-lg shadow-blue-500/30 border border-blue-400/30"
        >
          📊 Поделиться результатами
        </button>
      )}

      {/* Ежедневный бонус */}
      {showDailyBonus && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-6 max-w-sm w-full border border-cyan-400/30 shadow-2xl shadow-cyan-400/20">
            <div className="text-center">
              <Gift className="text-yellow-400 mx-auto mb-4 drop-shadow-lg" size={48} />
              <h3 className="text-xl font-bold mb-2 text-cyan-400">Ежедневный бонус!</h3>
              <p className="text-gray-300 mb-4">
                Получите {formatNumber(1000 * gameState.level)} монет
              </p>
              <button
                onClick={claimDailyBonus}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white px-6 py-3 rounded-xl font-semibold w-full transition-all shadow-lg shadow-yellow-400/30"
              >
                Получить бонус
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const UpgradesScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center drop-shadow-lg">Улучшения</h2>
        
        <div className="space-y-4">
          {/* Сила клика */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-red-400/30 shadow-lg shadow-red-400/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <Target className="text-red-400 drop-shadow-lg" size={24} />
                <div>
                  <div className="text-red-400 font-semibold">Сила клика</div>
                  <div className="text-red-300/60 text-sm">+1 монета за клик</div>
                </div>
              </div>
              <div className="text-red-400 text-sm font-medium">
                Уровень {gameState.upgrades.clickPower}
              </div>
            </div>
            <button
              onClick={() => buyUpgrade('clickPower')}
              disabled={gameState.upgrades.clickPower >= UPGRADE_COSTS.clickPower.length || 
                       gameState.coins < UPGRADE_COSTS.clickPower[gameState.upgrades.clickPower]}
              className={`w-full py-3 rounded-xl font-semibold transition-all
                ${gameState.upgrades.clickPower >= UPGRADE_COSTS.clickPower.length 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600' 
                  : gameState.coins >= UPGRADE_COSTS.clickPower[gameState.upgrades.clickPower]
                    ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white hover:scale-105 shadow-lg shadow-red-500/30 border border-red-400/30'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'}`}
            >
              {gameState.upgrades.clickPower >= UPGRADE_COSTS.clickPower.length 
                ? 'Максимум' 
                : `${formatNumber(UPGRADE_COSTS.clickPower[gameState.upgrades.clickPower])} монет`}
            </button>
          </div>

          {/* Вместимость энергии */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-blue-400/30 shadow-lg shadow-blue-400/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <Zap className="text-blue-400 drop-shadow-lg" size={24} />
                <div>
                  <div className="text-blue-400 font-semibold">Вместимость энергии</div>
                  <div className="text-blue-300/60 text-sm">+200 максимальной энергии</div>
                </div>
              </div>
              <div className="text-blue-400 text-sm font-medium">
                Уровень {gameState.upgrades.energyCapacity}
              </div>
            </div>
            <button
              onClick={() => buyUpgrade('energyCapacity')}
              disabled={gameState.upgrades.energyCapacity >= UPGRADE_COSTS.energyCapacity.length || 
                       gameState.coins < UPGRADE_COSTS.energyCapacity[gameState.upgrades.energyCapacity]}
              className={`w-full py-3 rounded-xl font-semibold transition-all
                ${gameState.upgrades.energyCapacity >= UPGRADE_COSTS.energyCapacity.length 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600' 
                  : gameState.coins >= UPGRADE_COSTS.energyCapacity[gameState.upgrades.energyCapacity]
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:scale-105 shadow-lg shadow-blue-500/30 border border-blue-400/30'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'}`}
            >
              {gameState.upgrades.energyCapacity >= UPGRADE_COSTS.energyCapacity.length 
                ? 'Максимум' 
                : `${formatNumber(UPGRADE_COSTS.energyCapacity[gameState.upgrades.energyCapacity])} монет`}
            </button>
          </div>

          {/* Восстановление энергии */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-green-400/30 shadow-lg shadow-green-400/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <TrendingUp className="text-green-400 drop-shadow-lg" size={24} />
                <div>
                  <div className="text-green-400 font-semibold">Восстановление энергии</div>
                  <div className="text-green-300/60 text-sm">+1 энергии в секунду</div>
                </div>
              </div>
              <div className="text-green-400 text-sm font-medium">
                Уровень {gameState.upgrades.energyRegen}
              </div>
            </div>
            <button
              onClick={() => buyUpgrade('energyRegen')}
              disabled={gameState.upgrades.energyRegen >= UPGRADE_COSTS.energyRegen.length || 
                       gameState.coins < UPGRADE_COSTS.energyRegen[gameState.upgrades.energyRegen]}
              className={`w-full py-3 rounded-xl font-semibold transition-all
                ${gameState.upgrades.energyRegen >= UPGRADE_COSTS.energyRegen.length 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600' 
                  : gameState.coins >= UPGRADE_COSTS.energyRegen[gameState.upgrades.energyRegen]
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 shadow-lg shadow-green-500/30 border border-green-400/30'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'}`}
            >
              {gameState.upgrades.energyRegen >= UPGRADE_COSTS.energyRegen.length 
                ? 'Максимум' 
                : `${formatNumber(UPGRADE_COSTS.energyRegen[gameState.upgrades.energyRegen])} монет`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const TasksScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center drop-shadow-lg">Задания</h2>
        
        <div className="space-y-4">
          {TASKS.map((task) => {
            const progress = getTaskProgress(task);
            const isCompleted = gameState.completedTasks.includes(task.id);
            const canComplete = progress >= task.requirement && !isCompleted;
            
            return (
              <div key={task.id} className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-yellow-400/30 shadow-lg shadow-yellow-400/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <Star className="text-yellow-400 drop-shadow-lg" size={24} />
                    <div>
                      <div className="text-yellow-400 font-semibold">{task.title}</div>
                      <div className="text-yellow-300/60 text-sm">
                        Награда: {formatNumber(task.reward)} монет
                      </div>
                    </div>
                  </div>
                  {isCompleted && (
                    <Award className="text-green-400 drop-shadow-lg" size={24} />
                  )}
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-yellow-300/60 mb-1">
                    <span>Прогресс</span>
                    <span>{Math.min(progress, task.requirement)}/{task.requirement}</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2 border border-yellow-400/20">
                    <div 
                      className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300 shadow-lg shadow-yellow-400/30"
                      style={{ width: `${Math.min((progress / task.requirement) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => completeTask(task.id, task.reward)}
                  disabled={!canComplete}
                  className={`w-full py-3 rounded-xl font-semibold transition-all
                    ${isCompleted 
                      ? 'bg-green-600 text-white cursor-not-allowed border border-green-500 shadow-lg shadow-green-600/30' 
                      : canComplete
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white hover:scale-105 shadow-lg shadow-yellow-500/30 border border-yellow-400/30'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'}`}
                >
                  {isCompleted ? 'Выполнено' : canComplete ? 'Получить награду' : 'Не выполнено'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const StatsScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center drop-shadow-lg">Статистика</h2>
        
        <div className="space-y-4">
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-yellow-400/30 shadow-lg shadow-yellow-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <Coins className="text-yellow-400 drop-shadow-lg" size={24} />
              <div className="text-yellow-400 font-semibold">Всего монет</div>
            </div>
            <div className="text-2xl font-bold text-yellow-300 drop-shadow-lg">{formatNumber(gameState.coins)}</div>
          </div>

          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-red-400/30 shadow-lg shadow-red-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <Target className="text-red-400 drop-shadow-lg" size={24} />
              <div className="text-red-400 font-semibold">Всего кликов</div>
            </div>
            <div className="text-2xl font-bold text-red-300 drop-shadow-lg">{formatNumber(gameState.totalClicks)}</div>
          </div>

          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-purple-400/30 shadow-lg shadow-purple-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <Trophy className="text-purple-400 drop-shadow-lg" size={24} />
              <div className="text-purple-400 font-semibold">Уровень</div>
            </div>
            <div className="text-2xl font-bold text-purple-300 drop-shadow-lg">{gameState.level}</div>
          </div>

          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-blue-400/30 shadow-lg shadow-blue-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <Zap className="text-blue-400 drop-shadow-lg" size={24} />
              <div className="text-blue-400 font-semibold">Энергия</div>
            </div>
            <div className="text-2xl font-bold text-blue-300 drop-shadow-lg">{gameState.energy}/{gameState.maxEnergy}</div>
          </div>

          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-green-400/30 shadow-lg shadow-green-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <Award className="text-green-400 drop-shadow-lg" size={24} />
              <div className="text-green-400 font-semibold">Выполнено заданий</div>
            </div>
            <div className="text-2xl font-bold text-green-300 drop-shadow-lg">{gameState.completedTasks.length}/{TASKS.length}</div>
          </div>

          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-orange-400/30 shadow-lg shadow-orange-400/20">
            <div className="flex items-center space-x-3 mb-2">
              <TrendingUp className="text-orange-400 drop-shadow-lg" size={24} />
              <div className="text-orange-400 font-semibold">Монет за клик</div>
            </div>
            <div className="text-2xl font-bold text-orange-300 drop-shadow-lg">{gameState.coinsPerClick}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const LeaderboardScreen = () => {
    useEffect(() => {
      if (activeTab === 'leaderboard') {
        loadLeaderboard();
      }
    }, [activeTab]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center drop-shadow-lg">🏆 Таблица лидеров</h2>
          
          <div className="space-y-3">
            {leaderboard.map((user, index) => {
              const isCurrentUser = telegramUser && user.telegram_id === telegramUser.id;
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
              const name = user.first_name || user.username || 'Аноним';
              
              return (
                <div 
                  key={user.telegram_id} 
                  className={`bg-black/30 backdrop-blur-sm rounded-2xl p-4 border transition-all
                    ${isCurrentUser 
                      ? 'border-cyan-400 shadow-lg shadow-cyan-400/30 bg-cyan-400/10' 
                      : index < 3 
                        ? 'border-yellow-400/30 shadow-lg shadow-yellow-400/20'
                        : 'border-gray-400/30 shadow-lg shadow-gray-400/20'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{medal}</div>
                      <div>
                        <div className={`font-semibold ${isCurrentUser ? 'text-cyan-400' : 'text-white'}`}>
                          {name} {isCurrentUser && '(Вы)'}
                        </div>
                        <div className="text-gray-400 text-sm">Уровень {user.level}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-400 font-bold">{formatNumber(user.coins)}</div>
                      <div className="text-gray-400 text-sm">{formatNumber(user.total_clicks)} кликов</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const ReferralsScreen = () => {
    useEffect(() => {
      if (activeTab === 'referrals') {
        loadReferralStats();
      }
    }, [activeTab]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-cyan-400 mb-6 text-center drop-shadow-lg">👥 Рефералы</h2>
          
          {/* Статистика */}
          {referralStats && (
            <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-green-400/30 shadow-lg shadow-green-400/20">
              <div className="text-center mb-4">
                <div className="text-green-400 text-lg font-semibold mb-2">Ваша статистика</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-green-300">{referralStats.total_referrals}</div>
                    <div className="text-green-400 text-sm">Приглашено</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-300">{formatNumber(referralStats.total_earnings)}</div>
                    <div className="text-yellow-400 text-sm">Заработано</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Реферальная ссылка */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-blue-400/30 shadow-lg shadow-blue-400/20">
            <div className="text-center">
              <div className="text-blue-400 font-semibold mb-3">Ваша реферальная ссылка</div>
              <div className="bg-black/40 rounded-lg p-3 mb-3 border border-blue-400/20">
                <div className="text-blue-300 text-sm font-mono break-all">
                  {gameState.referralCode ? `https://t.me/mirzagame_bot?start=${gameState.referralCode}` : 'Загрузка...'}
                </div>
              </div>
              <button
                onClick={copyReferralLink}
                disabled={!gameState.referralCode}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/30 border border-blue-400/30 flex items-center space-x-2 mx-auto"
              >
                <Copy size={16} />
                <span>Скопировать ссылку</span>
              </button>
            </div>
          </div>

          {/* Условия */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-yellow-400/30 shadow-lg shadow-yellow-400/20">
            <div className="text-yellow-400 font-semibold mb-3">💰 Условия программы:</div>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>За каждого приглашенного друга: <span className="text-green-400 font-semibold">1000 монет</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>Ваш друг получает: <span className="text-blue-400 font-semibold">500 бонусных монет</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>Награда начисляется мгновенно</span>
              </div>
            </div>
          </div>

          {/* Список рефералов */}
          {referralStats && referralStats.referrals && referralStats.referrals.length > 0 && (
            <div className="mt-6">
              <div className="text-cyan-400 font-semibold mb-3">Ваши рефералы:</div>
              <div className="space-y-2">
                {referralStats.referrals.map((referral, index) => (
                  <div key={index} className="bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-gray-400/30">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-white font-medium">
                          {referral.first_name || referral.username || 'Аноним'}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {formatNumber(referral.coins)} монет
                        </div>
                      </div>
                      <div className="text-green-400 font-semibold">+1000</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Основной контент */}
      <div className="pb-20">
        {activeTab === 'game' && <GameScreen />}
        {activeTab === 'upgrades' && <UpgradesScreen />}
        {activeTab === 'tasks' && <TasksScreen />}
        {activeTab === 'stats' && <StatsScreen />}
        {activeTab === 'leaderboard' && <LeaderboardScreen />}
        {activeTab === 'referrals' && <ReferralsScreen />}
      </div>

      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm border-t border-cyan-400/30">
        <div className="flex justify-around py-2">
          <button
            onClick={() => setActiveTab('game')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-xl transition-all
              ${activeTab === 'game' ? 'bg-cyan-400/20 text-cyan-400 shadow-lg shadow-cyan-400/30' : 'text-gray-400 hover:text-cyan-400'}`}
          >
            <Home size={20} />
            <span className="text-xs">Игра</span>
          </button>
          
          <button
            onClick={() => setActiveTab('upgrades')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-xl transition-all
              ${activeTab === 'upgrades' ? 'bg-cyan-400/20 text-cyan-400 shadow-lg shadow-cyan-400/30' : 'text-gray-400 hover:text-cyan-400'}`}
          >
            <ShoppingCart size={20} />
            <span className="text-xs">Улучшения</span>
          </button>
          
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-xl transition-all
              ${activeTab === 'tasks' ? 'bg-cyan-400/20 text-cyan-400 shadow-lg shadow-cyan-400/30' : 'text-gray-400 hover:text-cyan-400'}`}
          >
            <Star size={20} />
            <span className="text-xs">Задания</span>
          </button>
          
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-xl transition-all
              ${activeTab === 'leaderboard' ? 'bg-cyan-400/20 text-cyan-400 shadow-lg shadow-cyan-400/30' : 'text-gray-400 hover:text-cyan-400'}`}
          >
            <Crown size={20} />
            <span className="text-xs">Лидеры</span>
          </button>
          
          <button
            onClick={() => setActiveTab('referrals')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-xl transition-all
              ${activeTab === 'referrals' ? 'bg-cyan-400/20 text-cyan-400 shadow-lg shadow-cyan-400/30' : 'text-gray-400 hover:text-cyan-400'}`}
          >
            <Users size={20} />
            <span className="text-xs">Рефералы</span>
          </button>
          
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-xl transition-all
              ${activeTab === 'stats' ? 'bg-cyan-400/20 text-cyan-400 shadow-lg shadow-cyan-400/30' : 'text-gray-400 hover:text-cyan-400'}`}
          >
            <TrendingUp size={20} />
            <span className="text-xs">Статистика</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;