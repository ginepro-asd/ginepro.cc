import { useState, useEffect } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(deadline: Date): TimeLeft | null {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function useIsExpired(deadline: Date) {
  const [expired, setExpired] = useState(() => Date.now() >= deadline.getTime());
  useEffect(() => {
    if (expired) return;
    const id = setInterval(() => {
      if (Date.now() >= deadline.getTime()) {
        setExpired(true);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expired, deadline]);
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

interface CountdownProps {
  deadline: Date;
}

const Countdown = ({ deadline }: CountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => getTimeLeft(deadline));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

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
