import { type Page, type Locator } from "@playwright/test"

export class LoginPage {
  readonly page: Page
  readonly signInTab: Locator
  readonly createAccountTab: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly firstNameInput: Locator
  readonly lastNameInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.signInTab = page.getByRole("button", { name: "Sign In", exact: true })
    this.createAccountTab = page.getByRole("button", { name: "Create Account" })
    this.emailInput = page.getByPlaceholder("Enter your email")
    this.passwordInput = page.getByPlaceholder("Enter your password")
    this.firstNameInput = page.getByPlaceholder("Enter your first name")
    this.lastNameInput = page.getByPlaceholder("Enter your last name")
    this.submitButton = page.getByRole("button", { name: /Sign In →|Create Account →/ })
    this.errorMessage = page.locator(".text-red-400")
  }

  async goto() {
    await this.page.goto("/")
  }

  async signIn(email: string, password: string) {
    await this.signInTab.click()
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async createAccount(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) {
    await this.createAccountTab.click()
    await this.firstNameInput.fill(firstName)
    await this.lastNameInput.fill(lastName)
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.page.getByRole("button", { name: "Create Account →" }).click()
  }
}
