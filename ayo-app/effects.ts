// ayo-app/effects.ts - Visual flourishes drawn straight onto the page (no React state involved).

interface SkinColors { gradient: string; border: string }

const reducedMotion = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Captured seeds leave their pit(s), arc up and land in the taker's score chip, which pops as they arrive.
 * Pits and chips are found by `data-pit` / `data-score` attributes on the board. A decoration only:
 * if either end can't be found, or the player prefers reduced motion, it does nothing.
 */
export const flySeedsToScore = (
  pits: number[],
  count: number,
  seat: number,
  skin: SkinColors,
): void => {
  if (typeof document === 'undefined' || reducedMotion() || pits.length === 0) return;
  const target = document.querySelector<HTMLElement>(`[data-score="${seat}"]`);
  if (!target || typeof target.animate !== 'function') return;
  const tr = target.getBoundingClientRect();
  const tx = tr.left + tr.width / 2;
  const ty = tr.top + tr.height / 2;

  const n = Math.min(12, Math.max(3, count));
  const size = 14;
  let lastEnd = 0;
  for (let i = 0; i < n; i++) {
    const pit = document.querySelector<HTMLElement>(`[data-pit="${pits[i % pits.length]}"]`);
    if (!pit) continue;
    const pr = pit.getBoundingClientRect();
    const sx = pr.left + pr.width / 2 + rand(-pr.width * 0.22, pr.width * 0.22);
    const sy = pr.top + pr.height / 2 + rand(-pr.height * 0.22, pr.height * 0.22);
    const mx = (sx + tx) / 2 + rand(-40, 40);
    const my = Math.min(sy, ty) - rand(40, 90);

    const el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'fixed', left: '0', top: '0', width: `${size}px`, height: `${size}px`,
      marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`, borderRadius: '9999px',
      background: skin.gradient, border: `1.5px solid ${skin.border}`,
      boxShadow: '0 6px 12px rgba(0,0,0,0.5)', pointerEvents: 'none', zIndex: '9999', willChange: 'transform, opacity',
    });
    document.body.appendChild(el);

    const delay = i * 42;
    const duration = 560;
    lastEnd = Math.max(lastEnd, delay + duration);
    const anim = el.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 1 },
        { transform: `translate(${mx}px, ${my}px) scale(1.25)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.45)`, opacity: 0.85 },
      ],
      { duration, delay, easing: 'cubic-bezier(0.4, 0.1, 0.3, 1)', fill: 'both' },
    );
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
  }
  if (lastEnd > 0) {
    target.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }],
      { duration: 320, delay: Math.max(0, lastEnd - 200), easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' },
    );
  }
};
