"use client";

import { useState, useEffect } from "react";

// Summer sale — 7 days from launch (ends Jun 30, 2026 23:59:59)
const SALE_END = new Date("2026-06-30T23:59:59");

function calculateTimeLeft() {
  const difference = +SALE_END - +new Date();
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0 };
  }
  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
  };
}

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (document.visibilityState === "visible") {
        setTimeLeft(calculateTimeLeft());
      }
      const msToNextMinute = 60_000 - (Date.now() % 60_000);
      timeoutId = setTimeout(tick, msToNextMinute);
    };

    tick();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setTimeLeft(calculateTimeLeft());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span>{String(timeLeft.days).padStart(2, "0")}d</span>
      <span className="text-muted-foreground">:</span>
      <span>{String(timeLeft.hours).padStart(2, "0")}h</span>
      <span className="text-muted-foreground">:</span>
      <span>{String(timeLeft.minutes).padStart(2, "0")}m</span>
    </div>
  );
};

export default Countdown;