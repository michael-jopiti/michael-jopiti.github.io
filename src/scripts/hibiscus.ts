// A single ASCII hibiscus: a bud that opens, then the flower stays and its ripples keep moving.
import { range, reduced } from './view';

type RGB = [number, number, number];

const canvas = document.querySelector<HTMLCanvasElement>('canvas.waves')!;
const ctx = canvas.getContext('2d')!;
const nav = document.querySelector('nav')!;
const caption = document.querySelector('.caption')!;
const CELL_W = 7;
const CELL_H = 11;
const FONT = 'ui-monospace, Menlo, Consolas, monospace';
const start = performance.now();

function resize() {
	const dpr = Math.min(devicePixelRatio || 1, 2);
	canvas.width = innerWidth * dpr;
	canvas.height = innerHeight * dpr;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - (1 - clamp(x)) ** 3;
const mix = (a: RGB, b: RGB, k: number) => a.map((c, n) => Math.round(c + (b[n] - c) * k)) as RGB;
const ink = (rgb: RGB, alpha = 1) => {
	ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
};
// the line character that follows a direction, `angle` in radians with y pointing down
const along = (angle: number) => ['-', '\\', '|', '/'][Math.round((((angle % Math.PI) + Math.PI) % Math.PI) / (Math.PI / 4)) % 4];

// colors taken from the photos: crimson throat, pink bud, cream rim, yellow anthers, green calyx
const CRIMSON: RGB = [168, 18, 62];
const ROSE: RGB = [226, 70, 110];
const PINK: RGB = [238, 140, 165];
const BUD_LIGHT: RGB = [240, 212, 96]; // the bud's petals are yellow, like the open flower's rim
const BUD_DARK: RGB = [214, 170, 52];
const CREAM: RGB = [214, 192, 118];
const VEIN: RGB = [188, 186, 198];
const SEAM: RGB = [140, 138, 156];
const GREEN: RGB = [84, 132, 70];
const LIGHT_GREEN: RGB = [128, 170, 100];
const YELLOW: RGB = [244, 214, 70];
const ORANGE: RGB = [226, 150, 18];

// anthers on the staminal column, fixed so they do not jump around
let seed = 5;
const random = () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ANTHERS = Array.from({ length: 56 }, () => ({
	t: 0.42 + random() * 0.5,
	side: random() * 2 - 1,
	char: random() < 0.5 ? 'o' : '@',
}));

// what one frame needs to know about the flower
type Frame = {
	hx: number; // center of the flower
	tipY: number;
	fullR: number; // radius of the fully open flower
	R: number; // radius right now
	unit: number; // character scale
	open: number; // 0 closed, 1 open
	wind: number; // 0 freezes every ripple
};

// head, on a grid that moves with it so the characters stay put on the flower
function drawHead({ hx, tipY, fullR, R, unit, open, wind }: Frame) {
	const cw = CELL_W * unit;
	const ch = CELL_H * unit;
	// the bud leans to the left and straightens up as it opens
	const lean = -0.3 * (1 - open);
	const cosLean = Math.cos(lean);
	const sinLean = Math.sin(lean);
	// a bud is narrow and tall, an open flower is round with five petals
	const sx = 0.62 + 0.38 * open;
	const sy = 1.55 - 0.55 * open;
	const cols = Math.ceil((fullR * 1.3) / cw);
	const rows = Math.ceil((fullR * 1.3) / ch);

	for (let j = -rows; j <= rows; j++) {
		for (let i = -cols; i <= cols; i++) {
			const dx = i * cw;
			const dy = j * ch;
			// the same cell in the bud's own, tilted, frame
			const rx = dx * cosLean + dy * sinLean;
			const ry = -dx * sinLean + dy * cosLean;
			const u = rx / sx;
			const v = ry / sy;
			// a closed bud is pointed at the top
			const down = v / (R * sy); // -1 at the top of the bud, 1 at the bottom
			const narrow = 1 - 0.55 * (1 - open) * Math.max(0, -down);
			const th = Math.atan2(v, u / narrow) + Math.PI / 2; // 0 points up
			const lobe = 0.5 + 0.5 * Math.cos(5 * th);
			// Wavy margin. The ripples come in multiples of five, two or three per petal, and
			// are much smaller than the notch, so moving them never changes the five petals.
			const ruffle = 0.04 * Math.sin(10 * th + 1.7 + wind * 0.9) + 0.02 * Math.sin(15 * th + 0.4 - wind * 0.7);
			// round petal tops with a deep notch between neighbours
			const reach = R * (1 - open * 0.3 * (1 - lobe ** 0.6)) * (1 + open * ruffle);
			const rho = Math.hypot(u / narrow, v) / reach;
			if (rho > 1) continue;
			const x = hx + dx;
			const y = tipY + dy;

			// closed bud: green calyx round the lower part, yellow twisted petals above
			if (open < 0.3) {
				if (down > -0.1 + open * 3) {
					const stripe = Math.floor(u / 6) % 3 === 0;
					ink(stripe ? GREEN : LIGHT_GREEN);
					ctx.fillText(stripe ? '|' : ':', x, y);
				} else {
					const stripe = ((u * 0.8 + v) / 7) % 1 < 0.35;
					ink(stripe ? BUD_LIGHT : BUD_DARK);
					ctx.fillText(stripe ? '/' : ':', x, y);
				}
				continue;
			}

			const o = ease((open - 0.3) / 0.7);
			// where this cell sits across its petal: 0 on the middle of the petal, 1 on the seam
			const turns = (5 * th) / (2 * Math.PI);
			const edge = 1 - Math.abs(2 * (((turns % 1) + 1) % 1) - 1);
			// crimson throat with rays, fading out into the petal; the rays point at the middle of each petal
			const rays = 0.5 + 0.5 * Math.cos(5 * th);
			const t = rho / (0.3 + 0.3 * rays ** 1.5);
			const c = (1 - t) * (0.7 + 0.3 * rays) * Math.min(1, o * 1.6);
			if (c > 0.06) {
				const glyph = c > 0.8 ? '@' : c > 0.6 ? '#' : c > 0.42 ? '%' : c > 0.28 ? '&' : c > 0.15 ? '*' : ':';
				ink(mix(PINK, CRIMSON, clamp(c * 1.2)));
				ctx.fillText(glyph, x, y);
				continue;
			}
			// the rim of the petal, yellow while it unfolds and cream once open
			if (rho > 0.93) {
				ink(mix(BUD_LIGHT, CREAM, o));
				ctx.fillText(along(Math.atan2(ry, rx) + Math.PI / 2), x, y);
				continue;
			}
			// a seam line between every two petals, straight out from the throat
			if (edge > 1 - 0.05 / (rho + 0.25) && rho > 0.28) {
				ink(SEAM);
				ctx.fillText(along(Math.atan2(ry, rx)), x, y);
				continue;
			}
			// fine veins from the throat out, pink near the throat and grey further out
			// three veins per petal, the wind only bends them
			const vein = Math.abs(Math.sin(th * 15 + 1.3 * Math.sin(rho * 7 + wind * 0.4)));
			if (vein < 0.14) {
				ink(mix(ROSE, VEIN, clamp((rho - 0.3) / 0.4)), 0.75);
				ctx.fillText(along(Math.atan2(ry, rx)), x, y);
				continue;
			}
			// the body of the petal: lighter in the middle, heavier toward the seams, so each
			// petal reads as its own cushion
			const fold = clamp(0.9 * edge ** 1.5 + 0.1 * (0.5 + 0.5 * Math.sin(rho * 9 + wind * 0.3)));
			ink(mix(CREAM, VEIN, fold), 0.18 + 0.5 * fold);
			ctx.fillText(fold > 0.75 ? ';' : fold > 0.5 ? ':' : fold > 0.3 ? ',' : '.', x, y);
		}
	}
}

// the staminal column curls up and to the left, anthers near its top, five stigmas at the tip
function drawPistil({ hx, tipY, R, unit, open, wind }: Frame) {
	const grow = ease((open - 0.6) / 0.4);
	if (grow <= 0) return;
	const at = (k: number) => ({
		x: hx + (-0.4 * R * k + 0.06 * R * Math.sin(Math.PI * k)) * grow,
		y: tipY - 0.85 * R * k * grow,
	});
	for (let k = 0; k <= 1; k += 0.035) {
		const point = at(k);
		ink(mix(CREAM, YELLOW, k));
		ctx.fillText(k < 0.3 ? '|' : ':', point.x, point.y);
	}
	ink(ORANGE);
	for (const a of ANTHERS) {
		const point = at(a.t);
		const x = point.x + a.side * 0.1 * R * grow + 1.5 * Math.sin(wind * 1.1 + a.t * 20);
		const y = point.y + a.side * 0.03 * R * grow + 1.5 * Math.cos(wind * 0.9 + a.side * 5);
		ctx.fillText(a.char, x, y);
	}
	const tip = at(1);
	ink(YELLOW);
	for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]]) {
		ctx.fillText('O', tip.x + dx * 7 * unit, tip.y + dy * 8 * unit - 6 * unit);
	}
}

// Timeline in seconds: 0.5-3 the bud swells, 3.5-10 it opens, then it stays. The flower
// never moves as a whole, but its edges, veins and anthers keep drifting so it is never still.
function draw(now: number) {
	const sec = reduced ? 99 : (now - start) / 1000;
	const wind = reduced ? 0 : sec;
	ctx.clearRect(0, 0, innerWidth, innerHeight);

	const bud = ease((sec - 0.5) / 2.5);
	if (bud <= 0) return;
	const open = ease((sec - 3.5) / 6.5);

	// as big as the space between the nav and the strip allows, keeping some padding
	const pad = Math.max(24, Math.min(innerWidth, innerHeight) * 0.05);
	const top = nav.getBoundingClientRect().bottom + pad;
	const bottomEdge = caption.getBoundingClientRect().top - pad / 2;
	// the flower must fit the height and the width, whichever is smaller
	const fullR = Math.max(30, Math.min((bottomEdge - top) / 2, innerWidth / 2 - pad));
	// a smaller flower gets smaller characters, so it keeps its detail
	const unit = Math.min(1, Math.max(0.45, fullR / 175));
	ctx.font = `bold ${11 * unit}px ${FONT}`;

	const frame: Frame = {
		hx: innerWidth / 2,
		tipY: (top + bottomEdge) / 2,
		fullR,
		R: fullR * (0.38 * bud + 0.62 * open) * (1 + 0.012 * Math.sin(wind * 0.9)),
		unit,
		open,
		wind,
	};
	drawHead(frame);
	drawPistil(frame);
}

resize();
addEventListener('resize', () => {
	resize();
	draw(performance.now());
});
draw(performance.now());

if (!reduced) {
	let last = 0;
	const frame = (now: number) => {
		requestAnimationFrame(frame);
		// nothing to draw once the strip covers the screen
		if (now - last < 33 || scrollY > range() * 0.98) return;
		last = now;
		draw(now);
	};
	requestAnimationFrame(frame);
}
