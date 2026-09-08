import { render } from 'preact';
import { App } from './app';
import './styles.css';

render(<App />, document.getElementById('app')!);

// Onde de clic sur tout élément cliquable, depuis le point cliqué (un seul écouteur global).
const RIPPLE_TARGETS = '.btn, .chip, .tabs button, .pages button, .seg button, .tpl, .checkrow, .stepper button';
document.addEventListener('pointerdown', (e) => {
  const el = (e.target as Element | null)?.closest<HTMLElement>(RIPPLE_TARGETS);
  if (!el || el.matches(':disabled')) return;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const wave = document.createElement('span');
  wave.className = 'ripple';
  wave.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;`;
  el.appendChild(wave);
  wave.addEventListener('animationend', () => wave.remove(), { once: true });
  setTimeout(() => wave.remove(), 1000); // si l'animation n'a pas tourné (onglet masqué)
});
