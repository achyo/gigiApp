const { expect } = require('@playwright/test');

const ROLE_LABELS = {
  admin: 'Admin',
  specialist: 'Especialista',
  client: 'Cliente',
};

async function loginAs(page, role) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: `Acceder como ${ROLE_LABELS[role]}` }).click();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const submitButton = page.getByRole('button', { name: 'Entrar en la aplicación' });
    await expect(submitButton).toBeVisible();
    await page.waitForTimeout(250);
    await submitButton.click();
    await page.waitForTimeout(500);
    if (!page.url().endsWith('/login')) break;
    const connectionError = page.getByText('Error al conectar con el servidor');
    if (await connectionError.count()) {
      continue;
    }
  }
  await expect(page).not.toHaveURL(/\/login$/);
}

module.exports = {
  loginAs,
};