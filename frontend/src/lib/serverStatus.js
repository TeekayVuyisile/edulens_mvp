// The API runs on a free Render instance that sleeps when idle and takes up to a minute to
// wake. The app itself is a static site that never sleeps, so on load we start waking the API
// and hold API requests until it answers: otherwise the shared axios timeout (15 s) would
// expire during a cold start and sign returning users out of a perfectly good session.

/** Where the API lives: empty when it serves this page (or through the Vite proxy in dev). */
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let status = 'ready'; // checking | waking | ready | offline
let ready = Promise.resolve();
const listeners = new Set();

const setStatus = (next) => {
  status = next;
  listeners.forEach((listener) => listener());
};

export const getServerStatus = () => status;

export const subscribeServerStatus = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Resolves once the API has answered (or we gave up waiting). Already resolved unless waking. */
export const whenServerReady = () => ready;

/** Pings /api/health until the API answers. Called once at startup. */
export function wakeServer({ slowAfterMs = 1500, retryMs = 3000, giveUpAfterMs = 150_000, fetchImpl = fetch } = {}) {
  let release;
  ready = new Promise((resolve) => {
    release = resolve;
  });
  setStatus('checking');

  const started = Date.now();
  // Only mention waking up if the API doesn't answer straight away.
  const slowTimer = setTimeout(() => {
    if (status === 'checking') setStatus('waking');
  }, slowAfterMs);

  const finish = (next) => {
    clearTimeout(slowTimer);
    setStatus(next);
    release();
  };

  (async () => {
    while (Date.now() - started < giveUpAfterMs) {
      try {
        const res = await fetchImpl(`${API_ORIGIN}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
        if (res.ok) return finish('ready');
      } catch {
        // Still asleep or starting up: try again.
      }
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
    // Let held requests go through so they fail with the usual "cannot reach the server" message.
    return finish('offline');
  })();
}
