import { defineConfig } from '@playwright/test';

// Tests run against the built site, the same files that get deployed.
export default defineConfig({
	testDir: 'tests',
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: { baseURL: 'http://localhost:4321' },
	webServer: {
		command: 'npm run build && npm run preview -- --port 4321',
		url: 'http://localhost:4321',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
