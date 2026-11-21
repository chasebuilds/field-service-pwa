// Takes README screenshots from a running demo build. Usage: node scripts/shots.mjs http://localhost:4181/field-service-pwa/
import { chromium, devices } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4181/field-service-pwa/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 400, height: 860 }, colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(base);
await page.getByTestId('job-card').first().waitFor();
await page.waitForTimeout(700);
await page.screenshot({ path: 'docs/jobs.png' });
await page.getByTestId('job-card').filter({ hasText: 'No cooling' }).click();
await page.getByTestId('job-view').waitFor();
await page.waitForTimeout(700);
await page.screenshot({ path: 'docs/ticket.png' });
await page.getByRole('heading', { name: 'Parts used' }).scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
await page.screenshot({ path: 'docs/parts.png' });
await page.getByTestId('open-invoice').scrollIntoViewIfNeeded();
await page.getByTestId('open-invoice').click();
await page.getByTestId('invoice').waitFor();
await page.waitForTimeout(700);
await page.screenshot({ path: 'docs/invoice.png', fullPage: true });
await browser.close();
