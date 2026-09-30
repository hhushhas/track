import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

const execFileAsync = promisify(execFile)
const fixtureCommand = fileURLToPath(
  new URL('../../scripts/e2e/fixture-command.mjs', import.meta.url),
)

async function resetFixture() {
  await execFileAsync(process.execPath, [fixtureCommand, 'reset'], {
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
  })
}

async function signIn(page: Page) {
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' })
  const demoButton = page.getByRole('button', { name: 'Use Hasan Demo' })
  await expect(demoButton).toBeVisible({ timeout: 60_000 })
  // The server-rendered sign-in page is interactive after Better Auth's
  // initial session probe has written its client cache. Waiting on that probe
  // avoids clicking a still-unhydrated button on a cold Vite start.
  await expect.poll(
    () => page.evaluate(() => window.localStorage.getItem('better-auth_session_data')),
    { timeout: 60_000 },
  ).toBe('null')
  await demoButton.click()
  await expect.poll(() => page.url(), { timeout: 60_000 }).toMatch(/\/workspace/)
  await expect(page.getByText(/E2E .* Primary/, { exact: false }).first()).toBeVisible({ timeout: 60_000 })
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
}

function projectMenuButton(page: Page, name: RegExp) {
  return page.getByRole('button', { name }).first()
}

test.beforeEach(async () => {
  await resetFixture()
})

test('sign-in bootstrap and conversation write stay on the seeded project', async ({ page }, testInfo) => {
  await signIn(page)

  const sourceMessage = page.locator('article.track-message-row').filter({ hasText: 'E2E source message: assign an owner before launch.' }).first()
  await expect(sourceMessage).toBeVisible()
  const sourceTaskLink = sourceMessage.locator('.task-inline-cards > a').filter({ hasText: 'E2E source-linked task' }).first()
  await expect(sourceTaskLink).toBeVisible()
  await expect(sourceTaskLink.getByText('E2E source-linked task', { exact: true })).toBeVisible()
  await expect(sourceTaskLink).toContainText('Linked to this Channel message')

  const body = `browser journey message ${Date.now()}`
  const composer = page.getByPlaceholder('Message browser-journeys or ask @track...')
  await composer.fill(body)
  await page.getByRole('button', { name: /Send/ }).click()
  await expect(page.getByText(body, { exact: true })).toBeVisible({ timeout: 30_000 })
  await capture(page, testInfo, 'conversation-write')
})

test('project switching preserves the access scope boundary', async ({ page }, testInfo) => {
  await signIn(page)

  await projectMenuButton(page, /E2E .* Primary/).click()
  await page.getByText(/E2E .* Secondary/, { exact: false }).last().click()
  await expect(page.getByText('Secondary project scope stays isolated.', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('E2E source message: assign an owner before launch.', { exact: true })).toHaveCount(0)
  await capture(page, testInfo, 'project-scope')
})

test('task route opens the all-task List view and can switch to Board', async ({ page }, testInfo) => {
  await signIn(page)

  const tasksLink = page.getByRole('link', { name: /Tasks.*Boards, my tasks, inbox/ }).first()
  await expect(tasksLink).toBeVisible()
  await tasksLink.click()
  await expect.poll(() => page.url(), { timeout: 30_000 }).toMatch(/\/tasks\?/)
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('list')
  const workspaceViews = page.getByRole('navigation', { name: 'Task workspace view' })
  await expect(workspaceViews.getByRole('link', { name: 'Board', exact: true })).toBeVisible()
  await expect(workspaceViews.getByRole('link', { name: 'List', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(workspaceViews.getByRole('link', { name: 'Calendar', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Project conversation' })).toBeVisible()
  await expect(page.getByRole('table').getByText('E2E source-linked task', { exact: true })).toBeVisible({ timeout: 30_000 })
  await workspaceViews.getByRole('link', { name: 'Board', exact: true }).click()
  const boardCard = page.locator('article.task-card').filter({ hasText: 'E2E source-linked task' }).first()
  await expect(boardCard).toBeVisible({ timeout: 30_000 })
  const boardTask = boardCard.locator('button.task-card-open')
  await expect(boardTask).toContainText('E2E source-linked task')
  await boardTask.click()
  const taskDetail = page.locator('[data-slot="sheet-content"]').filter({ has: page.getByRole('heading', { name: 'Evidence' }) }).first()
  await expect(taskDetail).toBeVisible({ timeout: 30_000 })
  const evidenceSection = taskDetail.locator('section.task-detail-section').filter({ has: page.getByRole('heading', { name: 'Evidence', exact: true }) }).first()
  await expect(evidenceSection).toContainText('E2E source message: assign an owner before launch.')
  await capture(page, testInfo, 'task-board')
})

test('task filters and the seeded task persist across board, list, and calendar views', async ({ page }, testInfo) => {
  await signIn(page)

  await page.getByRole('link', { name: /Tasks.*Boards, my tasks, inbox/ }).first().click()
  await expect(page.getByRole('table').getByText('E2E source-linked task', { exact: true })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('textbox', { name: 'Search tasks' }).fill('source-linked')
  const priorityFilter = page.getByRole('combobox', { name: 'Filter by priority' })
  await priorityFilter.click()
  await page.getByRole('option', { name: 'High', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('source-linked')
  await expect.poll(() => new URL(page.url()).searchParams.get('priority')).toBe('high')

  const workspaceViews = page.getByRole('navigation', { name: 'Task workspace view' })
  await workspaceViews.getByRole('link', { name: 'Board', exact: true }).click()
  await expect(page.locator('article.task-card').filter({ hasText: 'E2E source-linked task' })).toBeVisible()
  await workspaceViews.getByRole('link', { name: 'List', exact: true }).click()
  await expect(page.getByRole('table').getByText('E2E source-linked task', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Search tasks' })).toHaveValue('source-linked')
  await expect(page.getByRole('combobox', { name: 'Filter by priority' })).toContainText('High')

  await workspaceViews.getByRole('link', { name: 'Calendar', exact: true }).click()
  const unscheduled = page.getByRole('region', { name: '1 unscheduled tasks' })
  await expect(unscheduled.getByText('E2E source-linked task', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next month' }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('month')).not.toBeNull()
  await expect(unscheduled.getByText('E2E source-linked task', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Today' }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('month')).toBeNull()
  await capture(page, testInfo, 'task-calendar-unscheduled')
})

test('task header actions open their intended controls', async ({ page }) => {
  await signIn(page)
  await page.getByRole('link', { name: /Tasks.*Boards, my tasks, inbox/ }).first().click()
  await expect(page.getByRole('table').getByText('E2E source-linked task', { exact: true })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'New task', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create task' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Task settings' }).click()
  await expect(page.getByRole('heading', { name: 'Task administration' })).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('button', { name: /task notifications/i })).toHaveCount(0)

  await page.getByRole('button', { name: 'More task actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Include archived tasks' })).toBeVisible()
})

test('archived channel renders as a read-only evidence surface', async ({ page }, testInfo) => {
  await signIn(page)

  await page.getByRole('button', { name: /Open channel archived-review/ }).click()
  await expect(page.getByText('Archived evidence remains available for review.', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByPlaceholder(/Message archived-review/)).toHaveCount(0)
  await capture(page, testInfo, 'archived-channel')
})
