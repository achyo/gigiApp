const { test, expect } = require('@playwright/test');
const { loginAs } = require('./helpers/auth');

test('admin puede iniciar sesión', async ({ page }) => {
  await loginAs(page, 'admin');
  await expect(page.getByRole('heading', { name: 'Panel global' })).toBeVisible();
});

test('specialist puede iniciar sesión', async ({ page }) => {
  await loginAs(page, 'specialist');
  await expect(page.getByRole('heading', { name: 'Panel del especialista' })).toBeVisible();
});

test('client puede iniciar sesión', async ({ page }) => {
  await loginAs(page, 'client');
  await expect(page.getByRole('heading', { name: 'Mis actividades' })).toBeVisible();
});