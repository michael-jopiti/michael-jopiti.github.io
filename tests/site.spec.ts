import { expect, test } from '@playwright/test';

test.beforeEach(({ page }) => {
	// any script error or failed request on any page fails the test
	page.on('pageerror', (error) => {
		throw error;
	});
	page.on('console', (msg) => {
		if (msg.type() === 'error') throw new Error(msg.text());
	});
});

test('home shows the name and draws the flower', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Michael Jopiti' })).toBeVisible();
	await expect(page.locator('.caption')).toContainText('Hibiscus rosa-sinensis');
	// the bud is drawn after half a second, so the canvas must hold some ink
	await page.waitForTimeout(1500);
	const inked = await page.locator('canvas.waves').evaluate((canvas: HTMLCanvasElement) => {
		const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
		return data.some((value, i) => i % 4 === 3 && value > 0);
	});
	expect(inked).toBe(true);
});

test('scrolling swaps home for about without loading a page', async ({ page }) => {
	await page.goto('/');
	let loads = 0;
	page.on('load', () => loads++);
	await page.evaluate(() => scrollTo(0, innerHeight));
	await expect(page).toHaveURL(/\/about\/$/);
	await expect(page).toHaveTitle('About Me');
	await expect(page.getByRole('heading', { name: 'About Me' })).toBeVisible();
	await page.evaluate(() => scrollTo(0, 0));
	await expect(page).toHaveURL(/\/$/);
	expect(loads).toBe(0);
});

test('about page opens on the about view', async ({ page }) => {
	await page.goto('/about/');
	await expect(page.getByRole('heading', { name: 'About Me' })).toBeVisible();
	await expect(page.locator('.scene.home')).toHaveAttribute('inert', '');
});

test('the About Me link glides to the about view', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'About Me' }).click();
	await expect(page).toHaveURL(/\/about\/$/);
});

test('projects link to the other sites', async ({ page }) => {
	await page.goto('/projects/');
	const hrefs = await page.locator('main a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
	expect(hrefs).toEqual(['/SIR/', '/Activations/']);
});

test('no horizontal scroll on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	for (const path of ['/', '/about/', '/projects/']) {
		await page.goto(path);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	}
});
