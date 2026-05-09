import { test, expect } from "@playwright/test"
import { AppPage } from "./pages/AppPage"

const EXCHANGES_GET_URL = "**/api/exchanges**"
const PORTFOLIOS_URL = "**/api/portfolio/portfolios/**"

const MOCK_EXCHANGE_RESPONSE = {
  id: 1,
  name: "New York Stock Exchange",
  code: "NYSE",
  type: "stock",
  country: "United States",
  is_active: true,
}

async function setupPreferencesWithExchangeManager(appPage: AppPage) {
  await appPage.setupAuth()
  const { page } = appPage

  await page.route(EXCHANGES_GET_URL, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )
  await page.route(PORTFOLIOS_URL, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )

  await appPage.goto()
  // ExchangeManager is rendered inside PreferencesScreen
  await appPage.userEmailButton.click()
  await expect(page.getByText("Preferences").first()).toBeVisible()
}

test.describe("Exchange Manager", () => {
  test("shows + Add Exchange button", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupPreferencesWithExchangeManager(appPage)

    await expect(page.getByRole("button", { name: "+ Add Exchange" })).toBeVisible()
  })

  test("clicking + Add Exchange opens modal", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupPreferencesWithExchangeManager(appPage)

    await page.getByRole("button", { name: "+ Add Exchange" }).click()

    await expect(page.getByRole("heading", { name: "Add New Exchange" })).toBeVisible()
  })

  test("modal has Name, Code, Type, Country fields", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupPreferencesWithExchangeManager(appPage)

    await page.getByRole("button", { name: "+ Add Exchange" }).click()

    // Scope to the modal overlay to avoid ambiguity with other selects on the page
    const modal = page.locator(".fixed.inset-0").last()
    await expect(modal.getByPlaceholder(/New York Stock Exchange/i)).toBeVisible()
    await expect(modal.getByPlaceholder("e.g. NYSE")).toBeVisible()
    await expect(modal.getByRole("combobox")).toBeVisible()
    await expect(modal.getByPlaceholder(/United States/i)).toBeVisible()
  })

  test("submitting with missing required fields does not close modal", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupPreferencesWithExchangeManager(appPage)

    await page.getByRole("button", { name: "+ Add Exchange" }).click()
    const modal = page.locator(".fixed.inset-0").last()
    // Click submit without filling any fields — HTML5 `required` blocks the submit
    await modal.getByRole("button", { name: "ADD EXCHANGE" }).click()

    // Modal must remain open
    await expect(modal.getByRole("heading", { name: "Add New Exchange" })).toBeVisible()
  })

  test("successful submit closes modal", async ({ page }) => {
    const appPage = new AppPage(page)
    await appPage.setupAuth()

    // Register exchange route before navigation — handles both GET and POST
    await page.route(EXCHANGES_GET_URL, (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_EXCHANGE_RESPONSE),
        })
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
      }
    })
    await page.route(PORTFOLIOS_URL, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    )

    await appPage.goto()
    await appPage.userEmailButton.click()
    await expect(page.getByText("Preferences").first()).toBeVisible()

    await page.getByRole("button", { name: "+ Add Exchange" }).click()
    const modal = page.locator(".fixed.inset-0").last()

    await modal.getByPlaceholder(/New York Stock Exchange/i).fill("NYSE Test")
    await modal.getByPlaceholder("e.g. NYSE").fill("NYSE")
    // Type select defaults to "stock" — no change required
    await modal.getByPlaceholder(/United States/i).fill("United States")

    await modal.getByRole("button", { name: "ADD EXCHANGE" }).click()

    await expect(page.getByRole("heading", { name: "Add New Exchange" })).not.toBeVisible({
      timeout: 5_000,
    })
  })
})
