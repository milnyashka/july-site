export interface AdItem {
  id: string;
  title: string;
  description: string;
  badge?: string;
  buttonText: string;
  url: string;
  imageUrl?: string;
  gradient?: string;
  sponsorName?: string;
}

export const SPONSOR_ADS: Record<number, AdItem> = {
  1: {
    id: 'vpn-promo',
    title: 'CyberShield VPN для геймеров',
    description: 'Минимальный пинг в любых играх, защита от DDoS и полный обход блокировок. Промокод JULY - 35% скидка!',
    badge: 'Спонсор шага 1',
    buttonText: 'Попробовать бесплатно',
    url: 'https://telegram.org',
    gradient: 'from-blue-600/20 via-indigo-600/10 to-transparent',
    sponsorName: 'CyberShield VPN',
  },
  2: {
    id: 'tg-channel',
    title: 'Наш Telegram-канал с раздачами',
    description: 'Ежедневные сливы бесплатных ключей, инсайды об обновлениях и розыгрыши подписок каждые 3 дня!',
    badge: 'Спонсор шага 2',
    buttonText: 'Подписаться на ТГ',
    url: 'https://t.me',
    gradient: 'from-sky-500/20 via-cyan-500/10 to-transparent',
    sponsorName: 'July Community TG',
  },
  3: {
    id: 'server-hosting',
    title: 'ApexNode — Игровой Хостинг',
    description: 'Мощные серверы на Ryzen 9 7950X с защитой от DDoS. Локации в РФ и Европе. Твой сервер за 2 минуты.',
    badge: 'Спонсор шага 3',
    buttonText: 'Арендовать сервер',
    url: 'https://google.com',
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    sponsorName: 'ApexNode Host',
  },
};

export const BANNER_ADS: AdItem[] = [
  {
    id: 'ad-banner-1',
    title: 'Приватные софты и читалки',
    description: 'Максимальный UNDETECT, быстрая поддержка 24/7 и авто-обновления под каждый патч.',
    badge: 'Реклама',
    buttonText: 'Каталог софта',
    url: '/products',
    gradient: 'from-purple-900/40 via-purple-600/20 to-background',
    sponsorName: 'July Software',
  },
  {
    id: 'ad-banner-2',
    title: 'Быстрая техподдержка в Telegram и Discord',
    description: 'Возникли вопросы по установке или настройке? Наша команда ответит вам за пару минут.',
    badge: 'Поддержка',
    buttonText: 'Связаться с нами',
    url: '/support',
    gradient: 'from-emerald-900/40 via-teal-600/20 to-background',
    sponsorName: 'July Support',
  },
];

export const TOP_LEADERBOARD_AD: AdItem = {
  id: 'top-leaderboard',
  title: '🔥 Премиум-подписка July VIP всего за 199₽',
  description: 'Безлимитный доступ к бесплатным ключам без ожиданий и таймеров!',
  badge: 'Спецпредложение',
  buttonText: 'Узнать больше',
  url: '/products',
  gradient: 'from-red-600/20 via-amber-600/15 to-transparent',
  sponsorName: 'July VIP Pass',
};
