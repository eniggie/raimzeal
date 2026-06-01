import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
} from "react-native-purchases";

const IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY     ?? "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";

export const ENTITLEMENT_ID = "premium";

let _configured = false;

export function configureRevenueCat() {
  if (_configured || Platform.OS === "web") return;
  if (!IOS_KEY && !ANDROID_KEY) return;
  Purchases.setLogLevel(LOG_LEVEL.WARN);
  const apiKey = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
  Purchases.configure({ apiKey });
  _configured = true;
}

export async function getOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.warn("[RevenueCat] getOffering error:", e);
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return null;
    throw e;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    console.warn("[RevenueCat] restorePurchases error:", e);
    return null;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn("[RevenueCat] getCustomerInfo error:", e);
    return null;
  }
}

export function hasPremium(info: CustomerInfo): boolean {
  return (
    info.entitlements.active[ENTITLEMENT_ID]?.isActive === true
  );
}

export type { PurchasesPackage, CustomerInfo, PurchasesOffering };
