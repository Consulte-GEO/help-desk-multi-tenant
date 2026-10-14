export type ThemePreference = 'auto' | 'light' | 'dark';
export type BrandProfile = Readonly<{
  id: 'consulte-geo' | 'neutral'; name: string; product: string; title: string;
  logoColor: string | null; logoWhite: string | null;
  eyebrow: string; intro: string; description: string;
}>;
export function getBrandProfile(id: unknown): BrandProfile;
export function themePreference(value: unknown): ThemePreference;
export const THEME_STORAGE_KEY: 'helpdesk.ui.theme';
