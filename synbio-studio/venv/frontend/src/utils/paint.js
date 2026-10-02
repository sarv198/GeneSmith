/**
 * Run a callback once the browser can paint.
 *
 * requestAnimationFrame never fires while the document is hidden, which would
 * leave a WebGL viewer permanently blank for anyone who opens the page in a
 * background tab. This falls back to a timer and to the next visibility change.
 *
 * Returns a cancel function.
 */
export function whenPaintable(callback) {
  let cancelled = false;
  let raf = 0;
  let timer = 0;

  const teardown = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };

  const run = () => {
    if (cancelled) return;
    teardown();
    callback();
  };

  function onVisibility() {
    if (document.visibilityState === "visible") run();
  }

  raf = requestAnimationFrame(run);
  timer = setTimeout(run, 150);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    cancelled = true;
    teardown();
  };
}
