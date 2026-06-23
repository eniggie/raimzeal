// Web stub — react-native-purchases is native-only.
// Metro resolves this file instead of revenuecat.ts on web builds,
// preventing the duplicate-React crash caused by the native SDK's web-mode init.

export const ENTITLEMENT_ID = "premium";

export type PurchasesPackage = never;
export type CustomerInfo = { entitlements: { active: Record<string, { isActive: boolean }> } };
export type PurchasesOffering = never;

export function configureRevenueCat(): void {}
export async function getOffering(): Promise<null> { return null; }
export async function purchasePackage(_pkg: PurchasesPackage): Promise<null> { return null; }
export async function restorePurchases(): Promise<null> { return null; }
export async function getCustomerInfo(): Promise<null> { return null; }
export function hasPremium(_info: CustomerInfo): boolean { return false; }
