import { Platform } from 'react-native';

export const STRIPE_DONATION_URL = 'https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00';
// External donation links are only allowed outside the app stores:
// Apple 3.1.1 / Google Play Billing treat platform-support donations as
// digital-content purchases that must go through IAP on mobile builds.
export const DONATION_ACTIVE = Boolean(
  Platform.OS === 'web' &&
  STRIPE_DONATION_URL &&
  STRIPE_DONATION_URL.startsWith('https://donate.stripe.com/') &&
  !STRIPE_DONATION_URL.includes('PLACEHOLDER')
);
export const RAIMZY_LINKTREE = 'https://linktr.ee/Raimzy';
