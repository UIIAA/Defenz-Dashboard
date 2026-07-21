// Throttle de login in-memory — feature-auth-individual §7. Freia brute-force por
// (e-mail+IP). In-memory = reseta por instância serverless; suficiente pra baixo volume.
// `now` injetável pra testes. Não substitui o rate-limit de /api/dashboard (é outro alvo).

interface Attempt {
  count: number;
  first: number; // ms epoch da 1ª falha da janela
}

const store = new Map<string, Attempt>();
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_KEYS = 5000; // teto defensivo de memória

export function throttleKey(email: string, ip: string): string {
  return `${email.toLowerCase()}|${ip}`;
}

export function isBlocked(key: string, now: number = Date.now()): boolean {
  const a = store.get(key);
  if (!a) return false;
  if (now - a.first > WINDOW_MS) {
    store.delete(key);
    return false;
  }
  return a.count >= MAX_FAILS;
}

export function recordFailure(key: string, now: number = Date.now()): void {
  const a = store.get(key);
  if (!a || now - a.first > WINDOW_MS) {
    if (store.size >= MAX_KEYS) store.clear(); // cap cru — internal tool
    store.set(key, { count: 1, first: now });
  } else {
    a.count += 1;
  }
}

export function clearFailures(key: string): void {
  store.delete(key);
}
