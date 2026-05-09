import { test, expect } from "@playwright/test"
import { AppPage } from "./pages/AppPage"

const PORTFOLIOS_URL = "**/api/portfolio/portfolios/**"

test.describe("Navigation", () => {
  let appPage: AppPage

  test.beforeEach(async ({ page }) => {
    appPage = new AppPage(page)
    await appPage.setupAuth()

    // Stub portfolios so InstrumentsScreen doesn't error when navigated to
    await page.route(PORTFOLIOS_URL, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    })

    await appPage.goto()
  })

  test("TopNav shows PORTFOLIO, TRADING, INSTRUMENTS nav items", async () => {
    await expect(appPage.portfolioNavButton).toBeVisible()
    await expect(appPage.tradingNavButton).toBeVisible()
    await expect(appPage.instrumentsNavButton).toBeVisible()
  })

  test("clicking TRADING switches to terminal screen", async ({ page }) => {
    await appPage.navigateTo("trading")

    // Instruments screen should not be visible after switching away
    await expect(page.getByText("Instrument Management")).not.toBeVisible()
  })

  test("clicking INSTRUMENTS switches to instruments screen", async ({ page }) => {
    await appPage.navigateTo("instruments")

    await expect(page.getByText("Instrument Management")).toBeVisible()
  })

  test("clicking PORTFOLIO switches back to portfolio screen", async ({ page }) => {
    await appPage.navigateTo("instruments")
    await expect(page.getByText("Instrument Management")).toBeVisible()

    await appPage.navigateTo("portfolio")

    await expect(page.getByText("Instrument Management")).not.toBeVisible()
  })

  test("clicking user email button navigates to preferences", async ({ page }) => {
    await appPage.userEmailButton.click()

    // "Preferences" is rendered in a div (not a heading role) in PreferencesScreen
    await expect(page.getByText("Preferences").first()).toBeVisible()
  })

  test("LOGOUT button is visible and clears session on click", async ({ page }) => {
    await expect(appPage.logoutButton).toBeVisible()

    await appPage.logout()

    await expect(page.getByPlaceholder("Enter your email")).toBeVisible()
  })
})
