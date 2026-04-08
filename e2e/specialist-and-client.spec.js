const { test, expect } = require('@playwright/test');
const { loginAs } = require('./helpers/auth');

test('specialist puede usar acciones masivas y client puede abrir el juego', async ({ browser }) => {
  const specialistPage = await browser.newPage();
  await loginAs(specialistPage, 'specialist');

  await specialistPage.goto('/specialist/clients');
  const firstClientCheckbox = specialistPage.locator('.clients-list-row input[type="checkbox"]').first();
  await firstClientCheckbox.check();
  await specialistPage.getByLabel('Asignar actividad a clientes seleccionados').selectOption({ index: 1 });
  await specialistPage.getByRole('button', { name: 'Asignar a selección' }).click();
  await expect(specialistPage.getByText('Actividad asignada a los clientes seleccionados.')).toBeVisible();

  await specialistPage.goto('/specialist/activities');
  const firstActivityCheckbox = specialistPage.locator('.entity-list-row input[type="checkbox"]').first();
  await firstActivityCheckbox.check();
  await specialistPage.getByRole('button', { name: 'Asignar selección a todos' }).click();
  await expect(specialistPage.getByText('Actividades reasignadas a todos tus clientes.')).toBeVisible();

  const clientPage = await browser.newPage();
  await loginAs(clientPage, 'client');
  await expect(clientPage.getByRole('heading', { name: 'Mis actividades' })).toBeVisible();
  await clientPage.getByRole('button', { name: /Empezar|Continuar|Repetir/ }).first().click();
  await expect(clientPage.getByRole('button', { name: 'Siguiente' })).toBeVisible();
  await clientPage.getByRole('button', { name: 'Siguiente' }).click();

  await specialistPage.close();
  await clientPage.close();
});