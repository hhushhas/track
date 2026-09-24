import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

const execFileAsync = promisify(execFile)
const fixtureCommand = fileURLToPath(new URL('../../scripts/e2e/fixture-command.mjs', import.meta.url))

test.use({ channel: 'chrome' })

test.beforeEach(async () => {
  await execFileAsync(process.execPath, [fixtureCommand, 'reset'], {
    env: process.env,
    timeout: 120_000,
  })
})

test('Company navigation is a dismissible mobile sheet and a stable desktop sidebar', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' })
  const demoButton = page.getByRole('button', { name: 'Use Hasan Demo' })
  await expect(demoButton).toBeVisible({ timeout: 60_000 })
  await expect.poll(
    () => page.evaluate(() => window.localStorage.getItem('better-auth_session_data')),
    { timeout: 60_000 },
  ).toBe('null')
  await demoButton.click()
  await expect.poll(() => page.url(), { timeout: 60_000 }).toMatch(/\/workspace/)
  const companyNameInput = page.getByRole('textbox', { name: 'Company name' })
  await expect(companyNameInput.or(page.getByText('Chrome QA Company').first())).toBeVisible({ timeout: 60_000 })
  if (await companyNameInput.isVisible()) {
    await companyNameInput.fill('Chrome QA Company')
    await page.getByRole('textbox', { name: 'Private handle' }).fill('chrome-qa-company')
    await page.getByRole('button', { name: 'Create Company' }).click()
  }
  await expect(page.getByText('Chrome QA Company').first()).toBeVisible()

  const openNavigation = page.getByRole('button', { name: 'Open Company navigation' })
  await expect(openNavigation).toBeVisible()
  const pageHeight = await page.locator('.company-reference-shell').evaluate((shell) => shell.getBoundingClientRect().height)
  await openNavigation.click()
  const sheet = page.getByRole('dialog', { name: 'Company workspace' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('navigation', { name: 'Company workspace' })).toBeVisible()
  await expect(sheet.getByRole('link', { name: 'Projects' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Log out' })).toBeVisible()
  await expect.poll(() => page.locator('.company-reference-shell').evaluate((shell) => shell.getBoundingClientRect().height)).toBe(pageHeight)
  await page.screenshot({ path: testInfo.outputPath('company-navigation-mobile-sheet.png') })
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(openNavigation).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 })
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `Company overview must not overflow at ${width}px`).toBeTruthy()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(openNavigation).toBeVisible()

  await openNavigation.click()
  await sheet.getByRole('button', { name: 'Close drawer' }).click()
  await expect(sheet).toBeHidden()
  await expect(openNavigation).toBeFocused()
  await openNavigation.click()
  await sheet.getByRole('link', { name: 'Projects' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/view=projects/)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(openNavigation).toBeHidden()
  await expect(page.getByRole('complementary', { name: 'Company and Project navigation' })
    .getByRole('navigation', { name: 'Company workspace' })).toBeVisible()
  await expect(page.getByText('Projects awaiting Company assignment')).toBeVisible({ timeout: 30_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.screenshot({ path: testInfo.outputPath('company-navigation-desktop.png') })
})
