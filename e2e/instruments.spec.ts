import { test, expect } from "@playwright/test"
import { AppPage } from "./pages/AppPage"

const PORTFOLIOS_LIST_URL = "**/api/portfolio/portfolios/"
const PORTFOLIO_DETAIL_URL = "**/api/portfolio/portfolios/1"
const TRANSACTIONS_URL = "**/api/portfolio/portfolios/1/transactions**"
const EXCHANGES_URL = "**/api/exchanges**"

const MOCK_PORTFOLIO_LIST = [
  { id: 1, user_id: "1", name: "My Portfolio", description: null, holdings: [] },
]

const MOCK_HOLDING = {
  id: 1,
  portfolio_id: 1,
  instrument_id: 10,
  quantity: 10,
  average_cost: 150.0,
  market_value: 1600.0,
  unrealized_pnl: 100.0,
  symbol: "AAPL",
  instrument_name: "Apple Inc.",
  instrument_type: "stocks",
  exchange: "NASDAQ",
  currency: "USD",
}

async function setupInstrumentsScreen(appPage: AppPage, holdings: object[] = []) {
  await appPage.setupAuth()
  const { page } = appPage

  await page.route(PORTFOLIOS_LIST_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_PORTFOLIO_LIST),
    }),
  )

  await page.route(PORTFOLIO_DETAIL_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...MOCK_PORTFOLIO_LIST[0], holdings }),
    }),
  )

  await page.route(TRANSACTIONS_URL, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )

  await page.route(EXCHANGES_URL, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  )

  await appPage.goto()
  await appPage.navigateTo("instruments")
}

test.describe("Instruments screen", () => {
  test("shows instrument type tabs", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupInstrumentsScreen(appPage)

    await expect(page.getByRole("button", { name: "Stocks" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Options" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Cryptocurrencies" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Corporate Bonds" })).toBeVisible()
  })

  test("shows holdings table when data loads", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupInstrumentsScreen(appPage, [MOCK_HOLDING])

    await expect(page.getByText("Loading instruments…")).not.toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole("cell", { name: "AAPL" })).toBeVisible()
    await expect(page.getByRole("cell", { name: "Apple Inc." })).toBeVisible()
  })

  test("shows empty state when no holdings", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupInstrumentsScreen(appPage, [])

    await expect(page.getByText("Loading instruments…")).not.toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(/No stocks in your portfolio/i)).toBeVisible()
  })

  test("shows loading state while fetching", async ({ page }) => {
    const appPage = new AppPage(page)
    await appPage.setupAuth()

    await page.route(PORTFOLIOS_LIST_URL, async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PORTFOLIO_LIST),
      })
    })
    await page.route(PORTFOLIO_DETAIL_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_PORTFOLIO_LIST[0], holdings: [] }),
      }),
    )
    await page.route(TRANSACTIONS_URL, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    )
    await page.route(EXCHANGES_URL, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    )

    await appPage.goto()
    await appPage.navigateTo("instruments")

    await expect(page.getByText("Loading instruments…")).toBeVisible()
  })

  test("+ BUY button opens transaction modal", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupInstrumentsScreen(appPage)

    await page.getByRole("button", { name: "+ BUY" }).click()

    await expect(page.getByRole("heading", { name: /Buy Stocks/i })).toBeVisible()
  })

  test("transaction modal has symbol, name, and market fields", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupInstrumentsScreen(appPage)

    await page.getByRole("button", { name: "+ BUY" }).click()

    // Symbol input — placeholder is "e.g. AAPL"
    await expect(page.getByPlaceholder("e.g. AAPL")).toBeVisible()
    // Name input — placeholder is "Apple Inc."
    await expect(page.getByPlaceholder("Apple Inc.")).toBeVisible()
    // Market is a <select> — label text is "Stock Market / Exchange *"
    await expect(page.getByText("Stock Market / Exchange *")).toBeVisible()
  })

  test("closing modal dismisses it", async ({ page }) => {
    const appPage = new AppPage(page)
    await setupInstrumentsScreen(appPage)

    await page.getByRole("button", { name: "+ BUY" }).click()
    await expect(page.getByRole("heading", { name: /Buy Stocks/i })).toBeVisible()

    // Click the ✕ close button inside the modal
    await page.locator("button").filter({ hasText: "✕" }).click()

    await expect(page.getByRole("heading", { name: /Buy Stocks/i })).not.toBeVisible()
  })
})
