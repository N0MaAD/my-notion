import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('public login experience', () => {
  test('exposes named controls and has no axe violations on the login card', async ({ page }) => {
    await page.goto('/notes')

    await expect(page.getByRole('heading', { name: 'My Notion' })).toBeVisible()
    await expect(page.getByRole('button', { name: /se connecter avec google/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /rester connecte/i })).toBeChecked()

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('.login-page')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('keeps authenticated app styles out of the public login bundle', async ({ page }) => {
    const stylesheetUrls = []

    page.on('response', (response) => {
      if (response.request().resourceType() === 'stylesheet') {
        stylesheetUrls.push(response.url())
      }
    })

    await page.goto('/notes')
    await expect(page.getByRole('button', { name: /se connecter avec google/i })).toBeVisible()

    expect(stylesheetUrls.some((url) => /\/app-[^/]+\.css$/.test(url))).toBe(false)
  })
})
