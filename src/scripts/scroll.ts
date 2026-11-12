import { range, reduced } from './view';

// Scrolling drives --p from 0 (home) to 1 (about). Everything else follows from it in CSS.
const root = document.documentElement;
const nav = document.querySelector('nav')!;
const home = document.querySelector<HTMLElement>('.scene.home')!;
const about = document.querySelector<HTMLElement>('.scene.about')!;
const start = document.querySelector<HTMLElement>('.band')!.dataset.start;
let shown = start;

history.scrollRestoration = 'manual';

function update() {
	const p = Math.min(1, Math.max(0, scrollY / range()));
	root.style.setProperty('--p', String(p));
	nav.style.visibility = p > 0.3 ? 'hidden' : '';
	home.inert = p > 0.7;
	about.inert = p < 0.7;

	// the address follows the view without loading anything
	const next = p > 0.7 ? 'about' : 'home';
	if (next !== shown) {
		shown = next;
		history.replaceState(null, '', next === 'about' ? '/about/' : '/');
		document.title = next === 'about' ? 'About Me' : 'Michael Jopiti';
	}
}

if (start === 'about') scrollTo(0, range());
update();
addEventListener('scroll', update, { passive: true });
addEventListener('resize', update);

let settled = start === 'about' ? 1 : 0; // the view the page is in, 0 home, 1 about
let animating = false;
let samples: { t: number; y: number }[] = [];
let pause: number;

// Glide to a view. The page is locked meanwhile so leftover wheel or trackpad momentum
// cannot fight the glide.
function snapTo(target: number) {
	const from = scrollY;
	const to = target * range();
	settled = target;
	if (animating || Math.abs(from - to) <= 1) return;
	animating = true;
	root.style.overflow = 'hidden';
	const duration = reduced ? 0 : Math.min(900, 350 + Math.abs(to - from) * 0.4);
	const t0 = performance.now();
	const step = (now: number) => {
		const k = duration ? Math.min(1, (now - t0) / duration) : 1;
		scrollTo(0, from + (to - from) * (1 - (1 - k) ** 3));
		if (k < 1) {
			requestAnimationFrame(step);
			return;
		}
		setTimeout(() => {
			root.style.overflow = '';
			animating = false;
			samples = [];
		}, 150);
	};
	step(t0);
}

// Magnet. Leaving a view takes 30% of the way, otherwise it pulls back. A fast flick
// does not wait for that: if its momentum would carry it past the edge, it completes.
// shortcut: momentum guessed as the last 100 ms speed times 250 ms, tune by feel.
addEventListener(
	'scroll',
	() => {
		if (animating) return;
		const now = performance.now();
		samples.push({ t: now, y: scrollY });
		while (samples[0].t < now - 100) samples.shift();
		const speed = now > samples[0].t ? (scrollY - samples[0].y) / (now - samples[0].t) : 0; // px/ms
		const projected = (scrollY + speed * 250) / range();
		if (Math.abs(speed) > 0.4 && (settled ? projected < 0.7 : projected > 0.3)) {
			snapTo(1 - settled);
			return;
		}
		clearTimeout(pause);
		pause = window.setTimeout(() => {
			const p = scrollY / range();
			snapTo(settled ? (p < 0.7 ? 0 : 1) : p > 0.3 ? 1 : 0);
		}, 120);
	},
	{ passive: true },
);

// the About Me link glides to the about view instead of loading a page
nav.querySelector('a[href="/about"]')!.addEventListener('click', (event) => {
	event.preventDefault();
	snapTo(1);
});
