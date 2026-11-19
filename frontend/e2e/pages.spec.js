import { test, expect } from '@playwright/test';

async function openWorkspace(page, id) {
  await page.goto('./');
  await expect(page.getByLabel('Student Name')).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Student Name').fill('Pages Test');
  await page.getByLabel('BT ID (College ID)').fill(id);
  await page.getByRole('button', { name: 'Continue to Workspace' }).click();
  await expect(
    page.getByRole('button', { name: 'Add transaction', exact: true }).first(),
  ).toBeEnabled({ timeout: 60000 });
}

test('Pages app saves transactions across reloads and tabs and keeps workspaces separate', async ({
  page,
  context,
}) => {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.log('Browser error:', error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('Browser console:', message.text());
  });
  await openWorkspace(page, 'BTPAGES001');
  await expect(page.getByText(/Saved only in this browser/)).toBeVisible();
  await page.getByRole('button', { name: 'Add transaction', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add transaction' });
  await dialog.getByRole('spinbutton').fill('200');
  await dialog.getByRole('combobox').selectOption({ label: 'Food' });
  await dialog.getByLabel(/Description/).fill('Pages test lunch');
  await dialog.getByLabel(/City/).fill('Delhi');
  await dialog.getByRole('button', { name: 'Add transaction', exact: true }).click();
  await expect(page.getByText('Transaction added.')).toBeVisible();
  await page.getByRole('button', { name: 'Transactions', exact: true }).click();
  await expect(page.getByText('Pages test lunch', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Add transaction', exact: true }).first(),
  ).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Transactions', exact: true }).click();
  await expect(page.getByText('Pages test lunch', { exact: true })).toBeVisible();

  const second = await context.newPage();
  await openWorkspace(second, 'BTPAGES001');
  await second.getByRole('button', { name: 'Transactions', exact: true }).click();
  await expect(second.getByText('Pages test lunch', { exact: true })).toBeVisible();

  const separate = await context.newPage();
  await openWorkspace(separate, 'BTPAGES002');
  await separate.getByRole('button', { name: 'Transactions', exact: true }).click();
  await expect(separate.getByText('No matching transactions')).toBeVisible();
  await expect(separate.getByText('Pages test lunch', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
