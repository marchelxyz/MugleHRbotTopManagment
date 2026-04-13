/**
 * Инъекция CSS-переменных для фоновых картинок темы (шапки, лого в меню, полоса разделов).
 */
const CSS_VAR_BY_KEY = {
  header_image_mobile: '--theme-header-image-mobile',
  header_image_desktop: '--theme-header-image-desktop',
  section_header_image: '--theme-section-header-image',
  sidenav_logo: '--theme-sidenav-logo',
};

function escapeUrlForCss(url) {
  return String(url).trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function injectThemeAssetStyles(themeAssets) {
  let el = document.getElementById('theme-asset-overrides');
  if (!el) {
    el = document.createElement('style');
    el.id = 'theme-asset-overrides';
    document.head.appendChild(el);
  }
  let css = '';
  for (const season of ['summer', 'winter']) {
    const className = season === 'summer' ? 'theme-summer' : 'theme-winter';
    const row = themeAssets?.[season];
    if (!row) continue;
    const parts = [];
    for (const [assetKey, cssVarName] of Object.entries(CSS_VAR_BY_KEY)) {
      const url = row[assetKey];
      if (url && String(url).trim()) {
        parts.push(`${cssVarName}: url('${escapeUrlForCss(url)}')`);
      }
    }
    if (parts.length) {
      css += `.${className}{${parts.join(';')}}`;
    }
  }
  el.textContent = css;
}
