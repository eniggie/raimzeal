import { rc } from "./revenueCatClient";

const PROJECT_NAME = "project-12sCosDt";

const APP_STORE_BUNDLE_ID = "app.replit.raimzeal";
const PLAY_STORE_PACKAGE_NAME = "com.econteur.raimzeal";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Access";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

const PLANS = [
  { key: "rise",   name: "Rise",   monthly: 4_990_000,   yearly: 39_990_000 },
  { key: "reign",  name: "Reign",  monthly: 9_990_000,   yearly: 79_990_000 },
  { key: "legacy", name: "Legacy", monthly: 19_990_000,  yearly: 149_990_000 },
] as const;

type AnyObj = Record<string, unknown>;

function orThrow<T>(result: { data?: T; error?: unknown }, msg: string): T {
  if (result.error || result.data === undefined) {
    throw new Error(`${msg}: ${JSON.stringify(result.error ?? "no data")}`);
  }
  return result.data as T;
}

async function seedRevenueCat() {

  // ── Project ──────────────────────────────────────────────────────────
  const projects = orThrow(
    await rc.get<{ items: AnyObj[] }>(`/v2/projects?limit=20`),
    "listProjects",
  );
  const project = projects.items?.find((p) => (p as AnyObj).name === PROJECT_NAME) as AnyObj | undefined;
  if (!project) throw new Error(`Project "${PROJECT_NAME}" not found. Found: ${projects.items?.map((p) => (p as AnyObj).name).join(", ")}`);
  const projectId = project.id as string;
  console.log("Project:", projectId, project.name);

  // ── Apps ─────────────────────────────────────────────────────────────
  const apps = orThrow(
    await rc.get<{ items: AnyObj[] }>(`/v2/projects/${projectId}/apps?limit=20`),
    "listApps",
  );

  const appStoreApp  = apps.items?.find((a) => a.type === "app_store") as AnyObj | undefined;
  const playStoreApp = apps.items?.find((a) => a.type === "play_store") as AnyObj | undefined;

  if (!appStoreApp)  throw new Error("App Store app not found");
  if (!playStoreApp) throw new Error("Play Store app not found");

  console.log("App Store app:", appStoreApp.id);
  console.log("Play Store app:", playStoreApp.id);

  // ── Products ─────────────────────────────────────────────────────────
  const existingProductsResp = orThrow(
    await rc.get<{ items: AnyObj[] }>(`/v2/projects/${projectId}/products?limit=100`),
    "listProducts",
  );
  const existingProducts = existingProductsResp.items ?? [];

  async function ensureProduct(storeId: string, appId: string, displayName: string): Promise<string> {
    const existing = existingProducts.find(
      (p) => p.store_identifier === storeId && p.app_id === appId,
    ) as AnyObj | undefined;
    if (existing) {
      console.log(`    Already exists [${storeId}]: ${existing.id}`);
      return existing.id as string;
    }
    const created = orThrow(
      await rc.post<AnyObj>(`/v2/projects/${projectId}/products`, {
        store_identifier: storeId,
        app_id: appId,
        type: "subscription",
        display_name: displayName,
      }),
      `createProduct [${storeId}]`,
    );
    console.log(`    Created [${storeId}]: ${created.id}`);
    return created.id as string;
  }

  type PlanRow = { pkgKey: string; pkgDisplay: string; iosId: string; androidId: string };
  const planRows: PlanRow[] = [];

  for (const plan of PLANS) {
    console.log(`\n── Plan: ${plan.name} ──`);
    for (const interval of ["monthly", "yearly"] as const) {
      const iosStoreId     = `raimzeal_${plan.key}_${interval}`;
      const androidStoreId = `raimzeal_${plan.key}:${interval}`;
      const displayName    = `${plan.name} ${interval === "monthly" ? "Monthly" : "Yearly"}`;

      console.log(`  [${interval}]`);
      const iosId     = await ensureProduct(iosStoreId,     appStoreApp.id  as string, displayName);
      const androidId = await ensureProduct(androidStoreId, playStoreApp.id as string, displayName);

      planRows.push({ pkgKey: iosStoreId, pkgDisplay: displayName, iosId, androidId });
    }
  }

  // ── Entitlement ───────────────────────────────────────────────────────
  console.log("\n── Entitlement ──");
  const entitlements = orThrow(
    await rc.get<{ items: AnyObj[] }>(`/v2/projects/${projectId}/entitlements?limit=20`),
    "listEntitlements",
  );
  let entitlementId: string;

  const existing = entitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER) as AnyObj | undefined;
  if (existing) {
    console.log("Entitlement already exists:", existing.id);
    entitlementId = existing.id as string;
  } else {
    const created = orThrow(
      await rc.post<AnyObj>(`/v2/projects/${projectId}/entitlements`, {
        lookup_key: ENTITLEMENT_IDENTIFIER,
        display_name: ENTITLEMENT_DISPLAY_NAME,
      }),
      "createEntitlement",
    );
    console.log("Created entitlement:", created.id);
    entitlementId = created.id as string;
  }

  const allProductIds = planRows.flatMap((r) => [r.iosId, r.androidId]);
  const attachResp = await rc.post<AnyObj>(
    `/v2/projects/${projectId}/entitlements/${entitlementId}/actions/attach_products`,
    { product_ids: allProductIds },
  );
  if (attachResp.error && (attachResp.error as AnyObj).type !== "unprocessable_entity_error") {
    throw new Error("Failed to attach products to entitlement: " + JSON.stringify(attachResp.error));
  }
  console.log("Products attached to entitlement");

  // ── Offering ──────────────────────────────────────────────────────────
  console.log("\n── Offering ──");
  const offerings = orThrow(
    await rc.get<{ items: AnyObj[] }>(`/v2/projects/${projectId}/offerings?limit=20`),
    "listOfferings",
  );
  let offeringId: string;
  const existingOffering = offerings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER) as AnyObj | undefined;

  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offeringId = existingOffering.id as string;
    if (!existingOffering.is_current) {
      await rc.patch<AnyObj>(`/v2/projects/${projectId}/offerings/${offeringId}`, { is_current: true });
      console.log("Set offering as current");
    }
  } else {
    const created = orThrow(
      await rc.post<AnyObj>(`/v2/projects/${projectId}/offerings`, {
        lookup_key: OFFERING_IDENTIFIER,
        display_name: OFFERING_DISPLAY_NAME,
      }),
      "createOffering",
    );
    console.log("Created offering:", created.id);
    offeringId = created.id as string;
    await rc.patch<AnyObj>(`/v2/projects/${projectId}/offerings/${offeringId}`, { is_current: true });
    console.log("Set offering as current");
  }

  // ── Packages ──────────────────────────────────────────────────────────
  console.log("\n── Packages ──");
  const existingPkgsResp = orThrow(
    await rc.get<{ items: AnyObj[] }>(`/v2/projects/${projectId}/offerings/${offeringId}/packages?limit=50`),
    "listPackages",
  );
  const existingPkgs = existingPkgsResp.items ?? [];

  for (const row of planRows) {
    const existing = existingPkgs.find((p) => p.lookup_key === row.pkgKey) as AnyObj | undefined;
    let packageId: string;

    if (existing) {
      console.log(`  Package already exists [${row.pkgKey}]: ${existing.id}`);
      packageId = existing.id as string;
    } else {
      const created = orThrow(
        await rc.post<AnyObj>(`/v2/projects/${projectId}/offerings/${offeringId}/packages`, {
          lookup_key: row.pkgKey,
          display_name: row.pkgDisplay,
        }),
        `createPackage [${row.pkgKey}]`,
      );
      console.log(`  Created package [${row.pkgKey}]: ${created.id}`);
      packageId = created.id as string;
    }

    const attachPkg = await rc.post<AnyObj>(
      `/v2/projects/${projectId}/packages/${packageId}/actions/attach_products`,
      {
        products: [
          { product_id: row.iosId,     eligibility_criteria: "all" },
          { product_id: row.androidId, eligibility_criteria: "all" },
        ],
      },
    );
    if (attachPkg.error && (attachPkg.error as AnyObj).type !== "unprocessable_entity_error") {
      throw new Error(`Failed to attach products to package [${row.pkgKey}]: ` + JSON.stringify(attachPkg.error));
    }
    console.log(`  Attached products to package [${row.pkgKey}]`);
  }

  // ── API Keys ──────────────────────────────────────────────────────────
  console.log("\n── API Keys ──");
  const iosKeys = orThrow(
    await rc.get<{ items: AnyObj[] }>(`/v2/projects/${projectId}/apps/${appStoreApp.id}/public_api_keys`),
    "listIosApiKeys",
  );
  const androidKeys = orThrow(
    await rc.get<{ items: AnyObj[] }>(`/v2/projects/${projectId}/apps/${playStoreApp.id}/public_api_keys`),
    "listAndroidApiKeys",
  );

  const iosKey     = iosKeys.items?.map((k) => k.key).join(", ") ?? "N/A";
  const androidKey = androidKeys.items?.map((k) => k.key).join(", ") ?? "N/A";

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:                  ", projectId);
  console.log("App Store App ID:            ", appStoreApp.id);
  console.log("Play Store App ID:           ", playStoreApp.id);
  console.log("Entitlement:                 ", ENTITLEMENT_IDENTIFIER);
  console.log("\nCopy these to your environment secrets:");
  console.log(`REVENUECAT_PROJECT_ID=${projectId}`);
  console.log(`REVENUECAT_APPLE_APP_STORE_APP_ID=${appStoreApp.id}`);
  console.log(`REVENUECAT_GOOGLE_PLAY_STORE_APP_ID=${playStoreApp.id}`);
  console.log(`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${iosKey}`);
  console.log(`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=${androidKey}`);
  console.log("====================\n");
}

seedRevenueCat().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
