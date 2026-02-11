import { useEffect, useRef } from "react";

export function usePolling(url: string, intervalMs: number) {
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const poll = async () => {
      try {
        await fetch(url, { method: "POST" });
      } catch {
        // ignore polling errors
      }
    };

    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [url, intervalMs]);
}
