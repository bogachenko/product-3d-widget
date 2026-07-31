import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  grepInvert: /resize, disconnect, reconnect and cleanup release owned browser resources/,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'vite --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/tests/fixtures/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        headless: false,
        launchOptions: {
          env: {
            ...process.env,
            LIBGL_ALWAYS_SOFTWARE: '1',
            MOZ_WEBRENDER: '1',
          },
          firefoxUserPrefs: {
            'gfx.webrender.fallback.software': true,
            'gfx.webrender.reject-software-driver': false,
            'gfx.webrender.software': true,
            'gfx.webrender.software.opengl': true,
            'webgl.disabled': false,
            'webgl.enable-webgl2': true,
            'webgl.forbid-software': false,
            'webgl.force-enabled': true,
            'webgl.ignore-blocklist': true,
          },
        },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
