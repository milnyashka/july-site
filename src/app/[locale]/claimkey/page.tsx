'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { AdBanner } from '@/components/ads/ad-banner';
import { GoogleAdUnit } from '@/components/ads/google-ad';
import { BANNER_ADS } from '@/lib/ads-config';
import { KeyRound, ShieldAlert, Sparkles, CheckCircle2, Copy, Zap, ShoppingCart } from 'lucide-react';

const WAIT_TIME = 20;
const TOTAL_STEPS = 3;

export default function ClaimKeyPage() {
  const [step, setStep] = useState(1);
  const [timeLeft, setTimeLeft] = useState(WAIT_TIME);
  const [key, setKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const stepParam = parseInt(params.get('step') || '1', 10);
      
      // Анти-абуз: проверяем макс. доступный шаг в сессии
      const unlockedStep = parseInt(sessionStorage.getItem('unlocked_step') || '1', 10);
      
      // Если попытался вбить ?step=3 в URL вручную — кидаем назад на разрешённый шаг
      if (stepParam > unlockedStep) {
        window.location.href = `${window.location.pathname}?step=${unlockedStep}`;
        return;
      }
      
      if (stepParam >= 1 && stepParam <= TOTAL_STEPS) {
        setStep(stepParam);
      }
    }
  }, []);

  useEffect(() => {
    let timerId: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(timerId);
      } else {
        startTimer();
      }
    };

    const startTimer = () => {
      clearInterval(timerId);
      timerId = setInterval(() => {
        if (!document.hidden) {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerId);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    };

    // Только если мы еще не получили ключ и время не вышло
    if (timeLeft > 0 && !key) {
      startTimer();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timeLeft, key]);

  const handleNextStep = async () => {
    if (step < TOTAL_STEPS) {
      const nextStep = step + 1;
      // Сохраняем разблокированный шаг в сессии пользователя
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('unlocked_step', nextStep.toString());
      }
      // Выполняем реальный переход на страницу следующего шага для перезагрузки объявлений Google AdSense
      window.location.href = `${window.location.pathname}?step=${nextStep}`;
    } else {
      setIsLoading(true);
      try {
        const res = await fetch('/api/claimkey', { method: 'POST' });
        const data = await res.json();
        
        if (res.ok && data.key) {
          setKey(data.key);
        } else {
          alert(data.error || 'Ошибка при получении ключа. Возможно, ключи закончились.');
        }
      } catch (err) {
        alert('Сетевая ошибка при получении ключа.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopyKey = () => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const progressPercentage = ((WAIT_TIME - timeLeft) / WAIT_TIME) * 100;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Заголовок страницы */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <KeyRound className="w-3.5 h-3.5" />
          Бесплатный генератор ключей
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Получение ключа</h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          Пожалуйста, подождите, пока генерируется ваш ключ. Выполняется шаг {step} из {TOTAL_STEPS}.
        </p>
      </div>

      {/* Главный блок выполнения шага */}
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary">
              Шаг {step} из {TOTAL_STEPS}
            </Badge>
          </div>
          <CardTitle className="text-xl sm:text-2xl">
            {key 
              ? "Ваш ключ готов!" 
              : `Ожидание генерации (${step}/${TOTAL_STEPS})`}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {key 
              ? "Спасибо! Ваш ключ успешно сгенерирован и готов к использованию." 
              : "Не закрывайте и не сворачивайте вкладку, иначе таймер остановится."}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center gap-6">
          {!key ? (
            <>
              {/* Цифровой таймер */}
              <div className="flex flex-col items-center gap-1">
                <div className="text-5xl font-mono font-extrabold tabular-nums text-primary tracking-tight">
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
                {timeLeft > 0 && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    Идет генерация ключа...
                  </span>
                )}
              </div>

              {/* Индикатор прогресса */}
              <div className="w-full space-y-1">
                <Progress value={progressPercentage} className="w-full h-3 rounded-full" />
                <div className="flex justify-between text-[11px] text-muted-foreground px-1 font-medium">
                  <span>Старт</span>
                  <span>{Math.round(progressPercentage)}%</span>
                  <span>Готово</span>
                </div>
              </div>

              {/* Блок «Не хотите ждать?» для моментальной покупки ключа без таймеров */}
              <div className="w-full p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-500 font-bold text-sm">
                    <Zap className="w-4 h-4 fill-amber-500 shrink-0" />
                    <span>Не хотите ждать таймер?</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Получите моментальный VIP-ключ без ожидания и выполнения шагов!
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold shrink-0 gap-1.5 shadow-md shadow-amber-500/20 w-full sm:w-auto"
                  asChild
                >
                  <Link href="/products">
                    <ShoppingCart className="w-4 h-4" />
                    Купить ключ без ожидания
                  </Link>
                </Button>
              </div>

              {/* Кнопка перехода к следующему шагу */}
              <Button 
                size="lg" 
                className="w-full sm:w-auto min-w-[240px] font-bold text-base shadow-md gap-2"
                disabled={timeLeft > 0 || isLoading}
                onClick={handleNextStep}
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-5 h-5 animate-spin" />
                    Генерация ключа...
                  </>
                ) : step === TOTAL_STEPS ? (
                  <>
                    <KeyRound className="w-5 h-5" />
                    Получить ключ
                  </>
                ) : (
                  <>
                    <span>Перейти к шагу {step + 1}</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            /* Экран с выданным ключом */
            <div className="flex flex-col items-center gap-5 w-full">
              <div className="w-full p-5 bg-primary/10 border-2 border-primary/30 rounded-xl text-center shadow-inner space-y-2">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                  Ваш активационный ключ:
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-extrabold text-primary select-all break-all tracking-wider">
                  {key}
                </span>
              </div>

              <Button 
                size="lg"
                variant={copied ? "secondary" : "default"}
                className="gap-2 font-bold w-full sm:w-auto min-w-[200px]"
                onClick={handleCopyKey}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Скопировано!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Скопировать ключ
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Информационное уведомление о поддержании сервиса рекламой */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
        <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Поддержите проект: </span>
          Бесплатная генерация ключей существует благодаря нашим спонсорам и рекламодателям. Если у вас включен AdBlock, пожалуйста, добавьте наш сайт в исключения.
        </div>
      </div>

      {/* 3. Сетка рекламных блоков (Google AdSense) */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground text-center">
          Рекламные предложения партнеров
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdBanner ad={BANNER_ADS[0]} type="banner-300x250" />
          <AdBanner ad={BANNER_ADS[1]} type="banner-300x250" />
        </div>
      </div>

      {/* Вторая позиция Google AdSense внизу страницы */}
      <GoogleAdUnit client="ca-pub-6910725183348370" slot="7828550365" />
    </div>
  );
}
