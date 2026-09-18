export type CardCategory = 'قلوب مفتوحة' | 'حلبة العائلة' | 'اقلب الطاولة';

export const CATEGORY_ICONS: Record<CardCategory, string> = {
  'قلوب مفتوحة': `<svg viewBox="0 0 80 80"><path d="M40 66 C18 50,8 36,8 24 C8 12,18 6,26 10 C33 13,38 20,40 26 C42 20,47 13,54 10 C62 6,72 12,72 24 C72 36,62 50,40 66 Z" fill="none" stroke="#c9a24b" stroke-width="5"/></svg>`,
  'حلبة العائلة': `<svg viewBox="0 0 80 80"><path d="M40 8 L48 30 L72 30 L52 45 L60 68 L40 54 L20 68 L28 45 L8 30 L32 30 Z" fill="#c9a24b" stroke="#c9a24b" stroke-width="2"/></svg>`,
  'اقلب الطاولة': `<svg viewBox="0 0 80 80"><path d="M20 25 A24 24 0 1 1 20 55" fill="none" stroke="#c9a24b" stroke-width="6" stroke-linecap="round"/><path d="M20 55 L10 47 M20 55 L27 45" fill="none" stroke="#c9a24b" stroke-width="6" stroke-linecap="round"/><path d="M60 55 A24 24 0 1 1 60 25" fill="none" stroke="#c9a24b" stroke-width="6" stroke-linecap="round"/><path d="M60 25 L70 33 M60 25 L53 35" fill="none" stroke="#c9a24b" stroke-width="6" stroke-linecap="round"/></svg>`,
};
