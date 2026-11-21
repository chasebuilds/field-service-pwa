import { expect, test } from '@playwright/test';

test('manifest is valid and the service worker takes control', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const res = await request.get(new URL(href ?? '', page.url()).toString());
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  expect(m.start_url).toBeTruthy();
  await page.evaluate(() => navigator.serviceWorker.ready);
});

test('ticket flow works and survives going offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByTestId('load-demo').click();
  await expect(page.getByTestId('job-card').first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  // open the in-progress ticket and add a part
  await page.getByTestId('job-card').filter({ hasText: 'No cooling' }).click();
  await expect(page.getByTestId('job-view')).toBeVisible();
  await expect(page.getByTestId('maps-link')).toHaveAttribute('href', /google\.com\/maps.*418%20Alder/);
  const before = await page.getByTestId('total').innerText();
  await page.getByLabel('Part name').fill('Fan motor');
  await page.getByLabel('Unit price').fill('120.00');
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await expect(page.getByTestId('part-row')).toHaveCount(3);
  await expect(page.getByTestId('total')).not.toHaveText(before);

  // time clock
  await page.getByTestId('clock-out').click();
  await expect(page.getByTestId('clock-in')).toBeVisible();

  // signature
  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.move(box.x + 30, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 40, { steps: 6 });
  await page.mouse.move(box.x + 200, box.y + 110, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Save signature' }).click();
  await expect(page.getByTestId('signature-saved')).toBeVisible();

  // invoice shows the same total
  const total = await page.getByTestId('total').innerText();
  await page.getByTestId('open-invoice').click();
  await expect(page.getByTestId('invoice-total')).toHaveText(total);

  // offline reload still works and data is still there
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('net-chip')).toContainText('Offline');
  await page.goto('/#/');
  await expect(page.getByTestId('job-card').first()).toBeVisible();
});
