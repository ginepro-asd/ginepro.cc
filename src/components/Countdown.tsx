import { useState, useEffect } from "react";

const DEADLINE = new Date("2026-03-29T23:59:59+02:00"); // CEST

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(): TimeLeft | null {
  const diff = DEADLINE.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function useIsExpired() {
  const [expired, setExpired] = useState(() => Date.now() >= DEADLINE.getTime());
  useEffect(() => {
    if (expired) return;
    const id = setInterval(() => {
      if (Date.now() >= DEADLINE.getTime()) {
        setExpired(true);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expired]);
  return expired;
}

const TimeUnit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shadow-lg">
      <span className="text-2xl sm:text-3xl font-display font-bold text-foreground">
        {String(value).padStart(2, "0")}
      </span>
    </div>
    <span className="text-xs sm:text-sm text-muted-foreground mt-1.5 font-medium uppercase tracking-wider">
      {label}
    </span>
  </div>
);

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timeLeft) {
    return (
      <p className="text-secondary font-display font-semibold text-lg">
        Le iscrizioni early-bird sono chiuse
      </p>
    );
  }

  return (
    <div className="flex gap-3 sm:gap-4">
      <TimeUnit value={timeLeft.days} label="Giorni" />
      <TimeUnit value={timeLeft.hours} label="Ore" />
      <TimeUnit value={timeLeft.minutes} label="Min" />
      <TimeUnit value={timeLeft.seconds} label="Sec" />
    </div>
  );
};

export default Countdown;
