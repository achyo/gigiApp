const { test, expect } = require('@playwright/test');
const { loginAs } = require('./helpers/auth');

test('admin puede crear un especialista, activar su suscripción y desactivarlo', async ({ page }) => {
  const stamp = Date.now();
  const name = `Especialista E2E ${stamp}`;
  const email = `e2e.${stamp}@example.com`;

  await loginAs(page, 'admin');

  await page.goto('/admin/specialists');
  await page.getByRole('button', { name: '+ Nueva cuenta' }).click();
  await page.getByLabel('Nombre completo').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Contraseña$/).fill('Spec1234!');
  await page.getByLabel(/^Confirmar contraseña$/).fill('Spec1234!');
  await page.getByLabel('Bio / especialidad').fill('Alta automática E2E');
  await page.getByRole('button', { name: 'Crear' }).click();

  await expect(page.getByText('Especialista creado correctamente.')).toBeVisible();
  await page.getByLabel('Buscar especialista o administrador...').fill(name);
  const specialistRow = page.locator('.entity-list-row').filter({ hasText: name }).first();
  await expect(specialistRow).toBeVisible();

  await page.goto('/admin/subscriptions');
  await page.getByLabel('Buscar...').fill(name);
  const subscriptionRow = page.locator('.entity-list-row').filter({ hasText: name }).first();
  await expect(subscriptionRow).toBeVisible();
  await subscriptionRow.getByRole('button', { name: /Gestionar/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Activa$/ }).click();
  await page.getByRole('button', { name: 'Guardar suscripción' }).click();
  await expect(page.getByText('¡Suscripción guardada!')).toBeVisible();

  await page.goto('/admin/specialists');
  await page.getByLabel('Buscar especialista o administrador...').fill(name);
  const deletionRow = page.locator('.entity-list-row').filter({ hasText: name }).first();
  await deletionRow.getByLabel('Eliminar').click();
  await page.getByRole('alertdialog').getByLabel('Eliminar').click();
  await expect(page.locator('.entity-list-row').filter({ hasText: name })).toHaveCount(0);
});