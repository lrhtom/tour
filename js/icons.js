const paths = {
  search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-left':'<path d="M20 12H4m6 6-6-6 6-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  'chevron-down':'<path d="m7 10 5 5 5-5"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.6 5.4L8 16l2.6-5.4L16 8Z"/>',
  bookmark:'<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
  'bookmark-filled':'<path d="M6 4h12v17l-6-4-6 4V4Z" fill="currentColor" stroke="currentColor"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  locate:'<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  museum:'<path d="m3 8 9-5 9 5H3Zm1 12h16M6 10v7m6-7v7m6-7v7M3 17h18"/>',
  castle:'<path d="M4 21V5h4v4h3V5h3v4h3V5h3v16H4Zm6 0v-6h4v6"/>',
  tree:'<path d="m12 2 6 8h-3l5 7H4l5-7H6l6-8Zm0 15v5"/>',
  art:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-4 5 5"/>',
  view:'<path d="m2 19 6-10 4 6 3-4 7 8H2ZM15 5h.1"/><circle cx="16" cy="5" r="2"/>',
  utensils:'<path d="M5 3v6m3-6v6M2 3v6a3 3 0 0 0 6 0M5 12v9m11-18c-3 4-3 8 0 9h3V3h-3Zm3 9v9"/>',
  street:'<path d="M3 21V8h6v13m6 0V3h6v18M1 21h22M5 11h2m-2 4h2m10-9h2m-2 4h2m-2 4h2M10 21l2-7 2 7"/>',
  route:'<path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="M9 15v-4h7m-3-3 3 3-3 3"/>',
  external:'<path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 7A7.5 7.5 0 0 1 19 8M5 16a7.5 7.5 0 0 0 13.5 1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  navigation:'<path d="m12 3 8 18-8-5-8 5 8-18Z"/>',
  layers:'<path d="m12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6"/>',
  list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
};
export function icon(name, size = 20) {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
  return wrapper.firstElementChild;
}
export function mountIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(node => node.replaceChildren(icon(node.dataset.icon))); }
