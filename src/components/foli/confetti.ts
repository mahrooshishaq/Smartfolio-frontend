/** Spawn a confetti burst into `host`. Uses the Web Animations API; self-cleans. */
export function burstConfetti(host: HTMLElement | null, count = 60) {
  if (!host) return;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  const colors = ['#818cf8', '#c084fc', '#ec4899', '#a855f7', '#f59e0b', '#12b981'];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('i');
    c.style.background = colors[i % colors.length];
    c.style.left = Math.random() * 100 + '%';
    c.style.top = '-5%';
    host.appendChild(c);
    const dx = (Math.random() * 2 - 1) * 60;
    const dy = 60 + Math.random() * 90;
    const rot = Math.random() * 720;
    c.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${dx}vw,${dy}vh) rotate(${rot}deg)`, opacity: 0.9 },
      ],
      { duration: 1800 + Math.random() * 900, easing: 'cubic-bezier(.2,.6,.3,1)' }
    );
    setTimeout(() => c.remove(), 2900);
  }
}
