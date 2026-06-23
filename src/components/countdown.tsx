"use client";

import { useState, useEffect } from "react";

// Summer sale — 7 days from launch (ends Jun 30, 2026 23:59:59)
const SALE_END = new Date("2026-06-30T23:59:59");

const Countdown = () => {
  const calculateTimeLeft = () => {
    const difference = +SALE_END - +new Date();
    let timeLeft = {
        days: 0,
        hours: 0,
        minutes: 0,
    };

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
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
