export function initializeTelegramViewport(webApp: any, host: Window = window, page: Document = document) {
  const style = page.documentElement.style;
  let pending = false;
  let unsupported = false;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  const safeCall = (name: string) => { try { webApp[name]?.(); } catch { /* Older Telegram clients keep the expanded layout. */ } };
  const sync = () => {
    const sizes = [webApp.viewportHeight, host.visualViewport?.height, host.innerHeight].filter(n => Number.isFinite(n) && n > 0);
    if (sizes.length) style.setProperty('--app-height', `${Math.round(Math.min(...sizes))}px`);
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      for (const [key, inset] of [['device', webApp.safeAreaInset], ['content', webApp.contentSafeAreaInset]] as const) {
        const value = Number(inset?.[edge]);
        style.setProperty(`--app-${key}-${edge}`, `${Number.isFinite(value) ? Math.max(0, value) : 0}px`);
      }
    }
    page.documentElement.dataset.fullscreen = webApp.isFullscreen ? 'true' : 'false';
  };
  const request = () => {
    sync();
    if (page.visibilityState === 'hidden') return;
    safeCall('expand');
    let supported = false;
    try { supported = webApp.isVersionAtLeast?.('8.0') && typeof webApp.requestFullscreen === 'function' && webApp.platform !== 'unknown'; } catch { /* Browser fallback. */ }
    if (!supported || unsupported || webApp.isFullscreen || pending) return;
    pending = true;
    pendingTimer = setTimeout(() => { pending = false; }, 3000);
    try { webApp.requestFullscreen(); }
    catch { unsupported = true; pending = false; clearTimeout(pendingTimer); }
  };
  const changed = () => { pending = false; clearTimeout(pendingTimer); sync(); };
  const failed = (event: { error?: string } = {}) => {
    pending = false; clearTimeout(pendingTimer);
    if (event.error === 'UNSUPPORTED') unsupported = true;
    sync();
  };
  const viewport = (event?: { isStateStable?: boolean }) => {
    sync();
    if (event?.isStateStable && webApp.isExpanded === false) safeCall('expand');
  };
  const events: [string, (...args: any[]) => void][] = [
    ['viewportChanged', viewport], ['safeAreaChanged', sync], ['contentSafeAreaChanged', sync],
    ['fullscreenChanged', changed], ['fullscreenFailed', failed], ['activated', request],
  ];
  for (const [event, handler] of events) webApp.onEvent?.(event, handler);
  page.addEventListener('visibilitychange', request);
  host.addEventListener('resize', sync);
  host.visualViewport?.addEventListener('resize', sync);
  safeCall('ready');
  try { webApp.setHeaderColor?.('#1c1c1e'); } catch { /* Optional API. */ }
  if (webApp.isVersionAtLeast?.('7.7')) safeCall('disableVerticalSwipes');
  request();
  return () => {
    clearTimeout(pendingTimer);
    for (const [event, handler] of events) webApp.offEvent?.(event, handler);
    page.removeEventListener('visibilitychange', request);
    host.removeEventListener('resize', sync);
    host.visualViewport?.removeEventListener('resize', sync);
  };
}
