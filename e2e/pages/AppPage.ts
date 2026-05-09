import { type Page, type Locator } from "@playwright/test"

export const MOCK_TOKEN = "mock-token-for-e2e"
export const MOCK_USER = {
  id: "1",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
}

export class AppPage {
  readonly page: Page
  readonly portfolioNavButton: Locator
  readonly tradingNavButton: Locator
  readonly instrumentsNavButton: Locator
  readonly userEmailButton: Locator
  readonly logoutButton: Locator

  constructor(page: Page) {
    this.page = page
    this.portfolioNavButton = page.getByRole("button", { name: "PORTFOLIO" })
    this.tradingNavButton = page.getByRole("button", { name: "TRADING", exact: true })
    this.instrumentsNavButton = page.getByRole("button", { name: "INSTRUMENTS" })
    this.userEmailButton = page.getByRole("button", { name: "test@example.com" })
    this.logoutButton = page.getByRole("button", { name: "LOGOUT" })
  }

  /**
   * Mocks the auth validate endpoint and seeds localStorage with a token.
   * Must be called before goto() so the script runs on page load.
   */
  async setupAuth() {
    await this.page.route("**/api/auth/validate", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ valid: true, user: MOCK_USER }),
      })
    })

    await this.page.addInitScript((token: string) => {
      localStorage.setItem("auth_token", token)
    }, MOCK_TOKEN)
  }

  async goto() {
    await this.page.goto("/")
    await this.portfolioNavButton.waitFor({ state: "visible", timeout: 10_000 })
  }

  async navigateTo(screen: "portfolio" | "trading" | "instruments") {
    const map: Record<string, Locator> = {
      portfolio: this.portfolioNavButton,
      trading: this.tradingNavButton,
      instruments: this.instrumentsNavButton,
    }
    await map[screen].click()
  }

  async logout() {
    await this.logoutButton.click()
  }
}
