import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
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
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // PONYTAIL: CI uses software WebGL; remove these flags when runners provide stable GPU-backed WebGL2.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // PONYTAIL: force software WebGL in headless CI; remove when Firefox runners expose WebGL2 by default.
        launchOptions: {
          firefoxUserPrefs: {
            'webgl.disabled': false,
            'webgl.force-enabled': true,
            'layers.acceleration.force-enabled': true,
          },
        },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
