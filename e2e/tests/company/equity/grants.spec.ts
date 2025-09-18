import { db, takeOrThrow } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { companyInvestorsFactory } from "@test/factories/companyInvestors";
import { equityGrantsFactory } from "@test/factories/equityGrants";
import { optionPoolsFactory } from "@test/factories/optionPools";
import { usersFactory } from "@test/factories/users";
import { fillDatePicker, findRichTextEditor, selectComboboxOption } from "@test/helpers";
import { login, logout } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { and, desc, eq } from "drizzle-orm";
import { DocumentTemplateType } from "@/db/enums";
import { companies, companyInvestors, documentTemplates, equityGrants } from "@/db/schema";
import { assertDefined } from "@/utils/assert";

test.describe("Equity Grants", () => {
  test("allows issuing equity grants", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "2.50", // Set a specific FMV share price
      conversionSharePriceUsd: "1.00", // Set conversion share price
      sharePriceInUsd: "2.50", // Set share price to match FMV
    });
    const { user: contractorUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await companyContractorsFactory.createCustom({ companyId: company.id });
    const { user: projectBasedUser } = await usersFactory.create();
    await companyContractorsFactory.createCustom({
      companyId: company.id,
      userId: projectBasedUser.id,
    });
    await optionPoolsFactory.create({ companyId: company.id });
    await login(page, adminUser, "/equity/grants");

    await page.getByRole("button", { name: "New grant" }).click();
    await expect(page.getByLabel("Number of options")).toHaveValue("10000");
    await selectComboboxOption(page, "Recipient", `${contractorUser.preferredName} (${contractorUser.email})`);

    await page.getByLabel("Number of options").fill("1000");
    await expect(page.getByText("Estimated value of $2,500, based on a $2.50 share price")).toBeVisible();

    await page.getByLabel("Number of options").fill("500");
    await expect(page.getByText("Estimated value of $1,250, based on a $2.50 share price")).toBeVisible();

    await page.getByLabel("Number of options").fill("10000");
    await expect(page.getByText("Estimated value of $25,000, based on a $2.50 share price")).toBeVisible();

    await page.getByLabel("Number of options").fill("10");
    await selectComboboxOption(page, "Relationship to company", "Consultant");

    await selectComboboxOption(page, "Grant type", "NSO");
    await selectComboboxOption(page, "Shares will vest", "As invoices are paid");
    await fillDatePicker(page, "Board approval date", new Date().toLocaleDateString("en-US"));
    await page.getByRole("button", { name: "Customize post-termination exercise periods" }).click();

    // Use more precise selectors focusing on the input fields directly
    await page.locator('input[name="voluntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="involuntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="terminationWithCauseExerciseMonths"]').fill("3");
    await page.locator('input[name="deathExerciseMonths"]').fill("12");
    await page.locator('input[name="disabilityExerciseMonths"]').fill("12");
    await page.locator('input[name="retirementExerciseMonths"]').fill("12");

    await page.getByLabel("Contract").setInputFiles({
      name: "contract.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("very signed contract"),
    });
    await page.getByRole("button", { name: "Create grant" }).click();

    await expect(page.getByRole("table")).toHaveCount(1);
    let rows = page.getByRole("table").first().getByRole("row");
    await expect(rows).toHaveCount(2);
    let row = rows.nth(1);
    await expect(row).toContainText(contractorUser.legalName ?? "");
    await expect(row).toContainText("10");
    const companyInvestor = await db.query.companyInvestors.findFirst({
      where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, contractorUser.id)),
    });
    assertDefined(
      await db.query.equityGrants.findFirst({
        where: eq(equityGrants.companyInvestorId, assertDefined(companyInvestor).id),
        orderBy: desc(equityGrants.createdAt),
      }),
    );

    await page.getByRole("button", { name: "New grant" }).click();

    // Fill in recipient (required)
    await selectComboboxOption(page, "Recipient", `${projectBasedUser.preferredName} (${projectBasedUser.email})`);

    // Fill in number of options (required)
    await page.getByLabel("Number of options").fill("20");

    // Fill in relationship to company (required)
    await selectComboboxOption(page, "Relationship to company", "Consultant");

    // Fill in required grant type
    await selectComboboxOption(page, "Grant type", "NSO");

    // Fill in required vesting details
    await selectComboboxOption(page, "Shares will vest", "As invoices are paid");

    // Fill in required board approval date (using today's date)
    await fillDatePicker(page, "Board approval date", new Date().toLocaleDateString("en-US"));

    // Fill in required exercise period fields
    await page.getByRole("button", { name: "Customize post-termination exercise periods" }).click();

    // Use more precise selectors focusing on the input fields directly
    await page.locator('input[name="voluntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="involuntaryTerminationExerciseMonths"]').fill("3");
    await page.locator('input[name="terminationWithCauseExerciseMonths"]').fill("3");
    await page.locator('input[name="deathExerciseMonths"]').fill("12");
    await page.locator('input[name="disabilityExerciseMonths"]').fill("12");
    await page.locator('input[name="retirementExerciseMonths"]').fill("12");

    await page.getByRole("tab", { name: "Write" }).click();
    await findRichTextEditor(page, "Contract").fill("This is a contract you must sign");

    await page.getByRole("button", { name: "Create grant" }).click();

    await expect(page.getByRole("table")).toHaveCount(1);
    rows = page.getByRole("table").first().getByRole("row");
    await expect(rows).toHaveCount(3);
    row = rows.nth(1);
    await expect(row).toContainText(projectBasedUser.legalName ?? "");
    await expect(row).toContainText("20");
    const projectBasedCompanyInvestor = await db.query.companyInvestors.findFirst({
      where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, projectBasedUser.id)),
    });
    assertDefined(
      await db.query.equityGrants.findFirst({
        where: eq(equityGrants.companyInvestorId, assertDefined(projectBasedCompanyInvestor).id),
        orderBy: desc(equityGrants.createdAt),
      }),
    );

    await logout(page);
    await login(page, contractorUser, "/invoices");
    await page.getByRole("link", { name: "New invoice" }).first().click();
    await page.getByLabel("Invoice ID").fill("CUSTOM-1");
    await fillDatePicker(page, "Date", "10/15/2024");
    await page.getByPlaceholder("Description").fill("Software development work");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/trpc/invoices.list") && r.status() === 200),
      page.getByRole("button", { name: "Send invoice" }).click(),
    ]);

    await expect(page.getByRole("cell", { name: "CUSTOM-1" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Oct 15, 2024");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");

    await logout(page);
    await login(page, projectBasedUser, "/invoices");
    await expect(page.getByText("You have an unsigned contract.")).toBeVisible();
    await page.getByRole("link", { name: "sign it" }).click();
    await expect(page.getByText("This is a contract you must sign")).toBeVisible();
    await page.getByRole("button", { name: "Add your signature" }).click();
    await expect(page.getByText(assertDefined(projectBasedUser.legalName))).toBeVisible();
    await page.getByRole("button", { name: "Agree & Submit" }).click();

    await page.getByRole("link", { name: "New invoice" }).first().click();
    await page.getByLabel("Invoice ID").fill("CUSTOM-2");
    await fillDatePicker(page, "Date", "11/01/2024");
    await page.getByPlaceholder("Description").fill("Promotional video production work");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/trpc/invoices.list") && r.status() === 200),
      page.getByRole("button", { name: "Send invoice" }).click(),
    ]);

    await expect(page.getByRole("cell", { name: "CUSTOM-2" })).toBeVisible();
    await expect(page.locator("tbody")).toContainText("Nov 1, 2024");
    await expect(page.locator("tbody")).toContainText("1,000");
    await expect(page.locator("tbody")).toContainText("Awaiting approval");
  });

  test("allows cancelling a grant", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "1",
    });
    const { companyInvestor } = await companyInvestorsFactory.create({ companyId: company.id });
    const { equityGrant } = await equityGrantsFactory.create({
      companyInvestorId: companyInvestor.id,
      vestedShares: 50,
      unvestedShares: 50,
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByRole("button", { name: "Confirm cancellation" }).click();
      },
      { page },
    );
    await expect(page.getByRole("button", { name: "Cancel" })).not.toBeVisible();
    expect(
      (await db.query.equityGrants.findFirst({ where: eq(equityGrants.id, equityGrant.id) }).then(takeOrThrow))
        .cancelledAt,
    ).not.toBeNull();
  });

  test("allows exercising options", async ({ page }) => {
    const { company } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      conversionSharePriceUsd: "1",
      jsonData: { flags: ["option_exercising"] },
    });
    const { user } = await usersFactory.create();
    await companyContractorsFactory.create({ companyId: company.id, userId: user.id });
    const { companyInvestor } = await companyInvestorsFactory.create({ companyId: company.id, userId: user.id });
    await equityGrantsFactory.create({ companyInvestorId: companyInvestor.id, vestedShares: 100 });

    await login(page, user);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Options" }).click();
    await expect(page.getByRole("heading", { name: "Options" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Exercise Options" })).not.toBeVisible();
    await db
      .insert(documentTemplates)
      .values({ companyId: company.id, documentType: DocumentTemplateType.ExerciseNotice, text: "I am exercising" });
    await page.reload();
    await expect(page.getByText("You have 100 vested options available for exercise.")).toBeVisible();
    await page.getByRole("button", { name: "Exercise Options" }).click();
    await withinModal(
      async (modal) => {
        await modal.getByLabel("Options to exercise").fill("10");
        await expect(modal.getByText("Exercise cost$50")).toBeVisible(); // 10 * $5 (exercise price)
        // Option value $1000 = 10 * $100 (option value)
        // Option value diff 1,900% = 1000 / 50 - 1 = 19x
        await expect(modal.getByText("Options valueBased on 2M valuation$1,0001,900%")).toBeVisible();

        await modal.getByRole("button", { name: "Proceed" }).click();
        await expect(modal.getByText("I am exercising")).toBeVisible();
        await modal.getByRole("button", { name: "Add your signature" }).click();
        await modal.getByRole("button", { name: "Agree & Submit" }).click();
      },
      { page },
    );
    await expect(page.getByText("We're awaiting a payment of $50 to exercise 10 options.")).toBeVisible();
  });

  test("handles missing FMV share price gracefully", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: null,
      conversionSharePriceUsd: "1.00", // Still need conversion price for the form to work
      sharePriceInUsd: null, // Also set share price to null since we're testing missing price scenario
    });
    const { user: contractorUser } = await usersFactory.create();
    await companyContractorsFactory.create({
      companyId: company.id,
      userId: contractorUser.id,
    });
    await optionPoolsFactory.create({
      companyId: company.id,
      authorizedShares: 20000n, // Ensure enough shares in the pool
      issuedShares: 0n, // No shares issued yet
    });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();

    // Open the modal
    await page.getByRole("button", { name: "New grant" }).click();

    await withinModal(
      async () => {
        await page.getByLabel("Number of options").fill("1000");
        // Test that estimated value is not shown when FMV share price is missing
        await expect(page.getByText("Estimated value:")).not.toBeVisible();
      },
      { page, assertClosed: false },
    );
  });

  test("shows exercise notice alert when no exercise notice is present", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({ equityEnabled: true });
    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();
    await expect(page.getByRole("heading", { name: "Equity grants" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("alert", { name: "exercise notice" })).not.toBeVisible();
    await db
      .update(companies)
      .set({ jsonData: { flags: ["option_exercising"] } })
      .where(eq(companies.id, company.id));
    await page.reload();
    await expect(
      page.getByRole("alert", { name: "Please add an exercise notice so investors can exercise their options." }),
    ).not.toBeVisible();
    await page.getByRole("link", { name: "add an exercise notice" }).click();
    await page.locator("[contenteditable=true]").fill("This is an exercise notice");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Equity grants" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("alert", { name: "Please add an exercise notice so investors can exercise their options." }),
    ).not.toBeVisible();
  });

  test("allows issuing equity grants to administrators", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding({
      equityEnabled: true,
      fmvPerShareInUsd: "1",
      conversionSharePriceUsd: "1.00",
      sharePriceInUsd: "1.00",
    });
    await optionPoolsFactory.create({ companyId: company.id });

    await companyContractorsFactory.create({ companyId: company.id });

    const { user: otherAdminUser } = await usersFactory.create();
    await companyAdministratorsFactory.create({ companyId: company.id, userId: otherAdminUser.id });

    await login(page, adminUser);
    await page.getByRole("button", { name: "Equity" }).click();
    await page.getByRole("link", { name: "Equity grants" }).click();
    await page.getByRole("button", { name: "New grant" }).click();

    await page.getByLabel("Number of options").fill("100");
    await selectComboboxOption(page, "Recipient", `${otherAdminUser.preferredName} (${otherAdminUser.email})`);
    await expect(page.getByLabel("Shares will vest")).not.toBeVisible();
    await selectComboboxOption(page, "Vesting schedule", "4-year with 1-year cliff (1/48th monthly after cliff)");
    await page.getByRole("tab", { name: "Write" }).click();
    await findRichTextEditor(page, "Contract").fill("This is a contract you must sign");

    await page.getByRole("button", { name: "Create grant" }).click();

    const row = page.locator("tbody tr").first();
    await expect(row).toContainText(otherAdminUser.legalName ?? "");
    await expect(row).toContainText("100");
  });
});
