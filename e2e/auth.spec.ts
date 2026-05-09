import { test, expect } from "@playwright/test"
import { LoginPage } from "./pages/LoginPage"
import { AppPage, MOCK_USER } from "./pages/AppPage"

const LOGIN_URL = "**/api/auth/login"
const VALIDATE_URL = "**/api/auth/validate"

test.describe("Authentication", () => {
  test("shows login form by default when not authenticated", async ({ page }) => {
    await page.route(VALIDATE_URL, (route) => {
      route.fulfill({ status: 401, body: JSON.stringify({ valid: false }) })
    })

    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(page.getByRole("button", { name: /Sign In →/ })).toBeVisible()
  })

  test("Sign In tab is active by default", async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(loginPage.signInTab).toBeVisible()
    await expect(loginPage.firstNameInput).not.toBeVisible()
    await expect(loginPage.lastNameInput).not.toBeVisible()
  })

  test("can switch to Create Account tab and shows name fields", async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.createAccountTab.click()

    await expect(loginPage.firstNameInput).toBeVisible()
    await expect(loginPage.lastNameInput).toBeVisible()
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
  })

  test("shows error message on failed login", async ({ page }) => {
    await page.route(LOGIN_URL, (route) => {
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Invalid credentials" }),
      })
    })

    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.signIn("wrong@example.com", "wrongpass")

    await expect(loginPage.errorMessage).toBeVisible()
    await expect(loginPage.errorMessage).toContainText(/Invalid credentials|Authentication failed/i)
  })

  test("successful login stores token and shows TopNav", async ({ page }) => {
    await page.route(LOGIN_URL, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { user: MOCK_USER, token: "fresh-token-123" },
        }),
      })
    })

    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.signIn("test@example.com", "password123")

    await expect(page.getByRole("button", { name: "PORTFOLIO" })).toBeVisible()
    await expect(page.getByRole("button", { name: "LOGOUT" })).toBeVisible()

    const token = await page.evaluate(() => localStorage.getItem("auth_token"))
    expect(token).toBe("fresh-token-123")
  })

  test("logout clears token and returns to login screen", async ({ page }) => {
    const appPage = new AppPage(page)
    await appPage.setupAuth()
    await appPage.goto()

    await appPage.logout()

    await expect(page.getByRole("button", { name: /Sign In →/ })).toBeVisible()

    const token = await page.evaluate(() => localStorage.getItem("auth_token"))
    expect(token).toBeNull()
  })

  test("page with valid token in localStorage skips login and shows TopNav", async ({ page }) => {
    const appPage = new AppPage(page)
    await appPage.setupAuth()
    await appPage.goto()

    await expect(page.getByRole("button", { name: "PORTFOLIO" })).toBeVisible()
    await expect(page.getByPlaceholder("Enter your email")).not.toBeVisible()
  })
})
