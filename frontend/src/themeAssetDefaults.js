/**
 * Дефолтные URL картинок темы (совпадают с index.css и прежними константами HomePage).
 * Подменяются значениями из app_settings.theme_assets при наличии.
 */
/**
 * Объединяет переопределения из API с дефолтами; пустые значения игнорируются.
 */
export function resolveSeasonAssets(seasonKey, themeAssets) {
  const base = THEME_ASSET_DEFAULTS[seasonKey] || THEME_ASSET_DEFAULTS.summer;
  const over = themeAssets?.[seasonKey] || {};
  const merged = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v != null && String(v).trim()) {
      merged[k] = String(v).trim();
    }
  }
  return merged;
}

export const THEME_ASSET_DEFAULTS = {
  summer: {
    header_image_mobile: 'https://i.postimg.cc/rw5Vy6Vk/обложка_правильная_1.webp',
    header_image_desktop: 'https://i.postimg.cc/9MvKPMj0/шапка_для_пк.webp',
    section_header_image: null,
    sidenav_logo: 'https://i.postimg.cc/zvmd8fQr/лого_зеленое_св.webp',
    thanks_button: 'https://i.postimg.cc/ncfzjKGc/кнопка_спасибки.webp',
    thanks_feed_logo: 'https://i.postimg.cc/cLCwXyrL/Frame_2131328056.webp',
    leaderboard_thanks_logo: 'https://i.postimg.cc/cLCwXyrL/Frame-2131328056.webp',
  },
  winter: {
    header_image_mobile: 'https://i.postimg.cc/7PFGNvRb/Gemini-Generated-Image-8bd3bh8bd3bh8bd3.webp',
    header_image_desktop: 'https://i.postimg.cc/HxHpsyT4/sapka-dla-pk-3-sin.webp',
    section_header_image: 'https://i.postimg.cc/6psSrhnR/sapka-ost-razdelov-sinaa.webp',
    sidenav_logo: 'https://i.postimg.cc/RVsHnPHk/LOGO-SP-SIN.webp',
    thanks_button: 'https://i.postimg.cc/kgrZQyKK/knopka-otpr-sp-sinaa.webp',
    thanks_feed_logo: 'https://i.postimg.cc/L5j1PRjr/LOGO-SP-UVED-SIN.webp',
    leaderboard_thanks_logo: 'https://i.postimg.cc/cLCwXyrL/Frame-2131328056.webp',
  },
};
