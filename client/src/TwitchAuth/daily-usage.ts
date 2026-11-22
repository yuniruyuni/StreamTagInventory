// Record visible use on entry, return to the tab, or interaction after midnight JST.
export function trackDailyUse(auth: Record<string, string> = {}) {
  let sent = "";
  let retryAfter = 0;
  const visit = async () => {
    if (document.visibilityState !== "visible" || Date.now() < retryAfter)
      return;
    const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    if (sent === day) return;
    retryAfter = Date.now() + 30000;
    try {
      const response = await fetch("/api/usage/visit", {
        method: "POST",
        headers: { "X-Yuniview-Visit": "1", ...auth },
        cache: "no-store",
        redirect: "error",
      });
      if (response.status === 204) sent = day;
    } catch {
      /* Telemetry is optional when storage or the network is unavailable. */
    }
  };
  void visit();
  document.addEventListener("visibilitychange", visit);
  document.addEventListener("pointerdown", visit);
  document.addEventListener("keydown", visit);
  return () => {
    document.removeEventListener("visibilitychange", visit);
    document.removeEventListener("pointerdown", visit);
    document.removeEventListener("keydown", visit);
  };
}
