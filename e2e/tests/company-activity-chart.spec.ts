import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

const execFileAsync = promisify(execFile)
const fixtureCommand = fileURLToPath(new URL('../../scripts/e2e/fixture-command.mjs', import.meta.url))

test.use({ channel: 'chrome' })

test.beforeEach(async () => {
  await execFileAsync(process.execPath, [fixtureCommand, 'reset'], { env: process.env, timeout: 120_000 })
})

test('Company activity chart shows real task creation in each selected range', async ({ page }, testInfo) => {
  const projectName = `Chart QA Project ${Date.now()}`
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' })
  const demoButton = page.getByRole('button', { name: 'Use Hasan Demo' })
  await expect(demoButton).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('better-auth_session_data')), { timeout: 60_000 }).toBe('null')
  await demoButton.click()
  await expect.poll(() => page.url(), { timeout: 60_000 }).toMatch(/\/workspace/)

  const companyNameInput = page.getByRole('textbox', { name: 'Company name' })
  await expect(companyNameInput.or(page.getByText('Chrome Chart Company').first())).toBeVisible({ timeout: 60_000 })
  if (await companyNameInput.isVisible()) {
    await companyNameInput.fill('Chrome Chart Company')
    await page.getByRole('textbox', { name: 'Private handle' }).fill('chrome-chart-company')
    await page.getByRole('button', { name: 'Create Company' }).click()
  }
  await expect(page.getByText('Chrome Chart Company').first()).toBeVisible()
  await page.getByRole('navigation', { name: 'Company workspace' }).getByRole('link', { name: 'Overview' }).click()

  await page.getByRole('button', { name: 'New project' }).first().click()
  const projectDialog = page.getByRole('dialog', { name: 'New project' })
  await projectDialog.getByRole('textbox', { name: 'Project name' }).fill(projectName)
  await projectDialog.getByRole('button', { name: 'Create Project' }).click()
  await expect(projectDialog).toBeHidden()

  await page.getByRole('button', { name: /Create task.*Turn an idea into action/ }).click()
  const projectPicker = page.getByRole('dialog', { name: 'Create task' })
  await projectPicker.getByRole('combobox', { name: 'Task project' }).click()
  await expect(page.getByRole('option', { name: projectName })).toBeVisible()
  await page.getByRole('option', { name: projectName }).click()
  await projectPicker.getByRole('button', { name: 'Continue' }).click()
  const taskDialog = page.getByRole('dialog', { name: 'Create task' })
  await taskDialog.getByRole('textbox', { name: 'Title' }).fill('Chart QA Task')
  await taskDialog.getByRole('button', { name: 'Create task' }).click()

  const chartPanel = page.locator('.company-dashboard-chart-panel')
  await expect(chartPanel.getByRole('table', { name: 'Created and completed tasks by day' })).toContainText('1')
  await expect(chartPanel.locator('.recharts-bar-rectangle').first()).toBeVisible()
  await chartPanel.locator('.recharts-bar').first().locator('.recharts-bar-rectangle').last().hover()
  await expect(chartPanel.locator('.recharts-tooltip-wrapper')).toContainText(/Created\s*:\s*[1-9]\d*/)
  await chartPanel.getByRole('heading', { name: 'Activity overview' }).hover()
  await chartPanel.screenshot({ path: testInfo.outputPath('company-activity-chart-7-days.png') })
  await page.screenshot({ path: testInfo.outputPath('company-overview-with-task.png'), fullPage: true })
  await chartPanel.getByRole('combobox', { name: 'Activity range' }).click()
  await page.getByRole('option', { name: 'Last 30 days' }).click()
  await expect(chartPanel.getByRole('table', { name: 'Created and completed tasks by day' })).toContainText('1')
  await chartPanel.getByRole('combobox', { name: 'Activity project' }).click()
  await page.getByRole('option', { name: projectName }).click()
  await expect(chartPanel.getByRole('table', { name: 'Created and completed tasks by day' })).toContainText('1')
  await chartPanel.getByRole('combobox', { name: 'Activity range' }).click()
  await page.getByRole('option', { name: 'Last 90 days' }).click()
  await expect(chartPanel.getByRole('table', { name: 'Created and completed tasks by day' })).toContainText('1')
  expect(await chartPanel.locator('.company-dashboard-chart-scroll').evaluate((element) => element.scrollWidth > element.clientWidth)).toBeTruthy()
  await expect.poll(() => chartPanel.locator('.company-dashboard-chart-scroll').evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await expect.poll(() => chartPanel.locator('.company-dashboard-chart-scroll').evaluate((element) => element.scrollLeft + element.clientWidth >= element.scrollWidth - 1)).toBeTruthy()
  const geometry = await page.evaluate(() => {
    const shell = document.querySelector('.company-reference-shell')
    const shellBottom = shell ? shell.getBoundingClientRect().bottom + window.scrollY : 0
    return {
      pageHeight: document.documentElement.scrollHeight,
      shellBottom,
    }
  })
  expect(geometry.pageHeight - geometry.shellBottom).toBeLessThanOrEqual(80)
  await page.screenshot({ path: testInfo.outputPath('company-overview-with-task-mobile.png'), fullPage: true })
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await expect.poll(() => chartPanel.locator('.company-dashboard-chart-scroll').evaluate((element) => element.scrollLeft + element.clientWidth >= element.scrollWidth - 1)).toBeTruthy()
  }
  const chartScroll = chartPanel.locator('.company-dashboard-chart-scroll')
  await expect(chartScroll).toHaveAttribute('tabindex', '0')
  const recentPosition = await chartScroll.evaluate((element) => element.scrollLeft)
  await chartScroll.focus()
  await chartScroll.press('ArrowLeft')
  await expect.poll(() => chartScroll.evaluate((element) => element.scrollLeft)).toBeLessThan(recentPosition)
  expect(pageErrors).toEqual([])
})
