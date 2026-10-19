import { useEffect, useState } from 'react';

export default function useChatTimeout(until) {
  const [now, setNow] = useState(Date.now);
  const expires = until ? new Date(until).getTime() : 0;
  useEffect(() => {
    setNow(Date.now());
    if (!(expires > Date.now())) return undefined;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expires) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [expires]);
  const remaining = Math.max(0, Math.ceil((expires - now) / 1000));
  return { active: remaining > 0, label: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` };
}
