import UNIVERSITY_CITIES from '../data/university-cities.js?v=20261110-nature-8';
const BASE_CITIES = [
  { id: 'london', name: '伦敦', en: 'London', lat: 51.5085, lng: -0.1257, nation: 'England', zoom: 13 },
  { id: 'birmingham', name: '伯明翰', en: 'Birmingham', lat: 52.4796, lng: -1.903, nation: 'England', zoom: 13 },
  { id: 'edinburgh', name: '爱丁堡', en: 'Edinburgh', lat: 55.9519, lng: -3.191, nation: 'Scotland', zoom: 13 },
  { id: 'cardiff', name: '卡迪夫', en: 'Cardiff', lat: 51.4816, lng: -3.1791, nation: 'Wales', zoom: 13 },
  { id: 'belfast', name: '贝尔法斯特', en: 'Belfast', lat: 54.5973, lng: -5.9301, nation: 'Northern Ireland', zoom: 13 },
  { id: 'bath', name: '巴斯', en: 'Bath', lat: 51.3811, lng: -2.359, nation: 'England', zoom: 14 },
  { id: 'york', name: '约克', en: 'York', lat: 53.959, lng: -1.0815, nation: 'England', zoom: 14 },
  { id: 'oxford', name: '牛津', en: 'Oxford', lat: 51.7548, lng: -1.2544, nation: 'England', zoom: 14 },
  { id: 'cambridge', name: '剑桥', en: 'Cambridge', lat: 52.2053, lng: 0.1218, nation: 'England', zoom: 14 },
  { id: 'salisbury', name: '索尔兹伯里', en: 'Salisbury', lat: 51.0688, lng: -1.7945, nation: 'England', zoom: 12 },
  { id: 'bray', name: '布雷', en: 'Bray', lat: 51.508, lng: -0.701, nation: 'England', zoom: 14 },
  { id: 'marlow', name: '马洛', en: 'Marlow', lat: 51.5719, lng: -0.7769, nation: 'England', zoom: 14 },
];
export const CITIES = [...BASE_CITIES, ...UNIVERSITY_CITIES.filter(city => !BASE_CITIES.some(base => base.id === city.id))];
export const CATEGORIES = {
  all: { name: '全部', icon: 'compass', color: '#1a73e8' },
  restaurant: { name: '餐饮', icon: 'utensils', color: '#d56a18' },
  market: { name: '集市', icon: 'market', color: '#ba6b18' },
  shopping: { name: '购物', icon: 'shopping', color: '#a14288' },
  university: { name: '大学', icon: 'university', color: '#3f5fa4' },
  district: { name: '街区', icon: 'street', color: '#5664b9' },
  museum: { name: '博物馆', icon: 'museum', color: '#a142c1' },
  historic: { name: '历史', icon: 'castle', color: '#b06029' },
  nature: { name: '自然', icon: 'tree', color: '#188038' },
  art: { name: '艺术', icon: 'art', color: '#c5221f' },
  viewpoint: { name: '观景', icon: 'view', color: '#007b83' },
  attraction: { name: '景点', icon: 'pin', color: '#1a73e8' },
};
export const CUISINES = {
  british: '英式', french: '法式', italian: '意式', spanish: '西班牙菜',
  taiwanese: '台式', chinese: '中式', 'south-asian': '印度 / 南亚',
  'pan-asian': '亚洲风味', european: '欧陆', modern: '现代料理',
  bakery: '烘焙', international: '国际料理',
  brazilian: '巴西烤肉',
  turkish: '土耳其', caribbean: '加勒比风味',
};
export const NATURE_TYPES = {
  'national-park': '国家公园', coast: '海岸', lake: '湖泊', waterfall: '瀑布',
  mountain: '山峰', woodland: '森林', 'nature-reserve': '自然保护区',
  'park-garden': '公园与园林', landscape: '山野与峡谷', cave: '洞穴',
};
export function isVerifiedBuffet(place) {
  const proof = place.dining?.buffetVerification || place.dining?.serviceVerification;
  if (place.category !== 'restaurant' || !['buffet', 'hybrid', 'table-service-unlimited', 'unlimited'].includes(place.dining?.service)
    || proof?.status !== 'official-verified' || !proof.excerpt?.trim()
    || !/^\d{4}-\d{2}-\d{2}$/.test(proof.checkedAt || '')) return false;
  try {
    const source = new URL(proof.sourceUrl), venue = new URL(place.website);
    return source.protocol === 'https:' && source.hostname.replace(/^www\./, '') === venue.hostname.replace(/^www\./, '');
  } catch { return false; }
}
export function isBrandBuffet(place) {
  const proof = place.dining?.buffetVerification;
  if (place.category !== 'restaurant' || proof?.status !== 'brand-inferred' || proof.scope !== 'brand'
    || !proof.brandId || proof.brandId !== place.dining?.brandId || !proof.sourcePlaceId
    || !/^\d{4}-\d{2}-\d{2}$/.test(proof.checkedAt || '')) return false;
  try { return new URL(proof.sourceUrl).protocol === 'https:' && new URL(proof.branchUrl).protocol === 'https:'; }
  catch { return false; }
}
export function hasBuffetService(place) { return isVerifiedBuffet(place) || isBrandBuffet(place); }
export function cuisineLabel(place) {
  return (place.dining?.cuisines || []).map(key => CUISINES[key]).filter(Boolean).slice(0, 2).join(' / ');
}
export function placeTypeLabel(place) {
  if (place.category === 'nature') return NATURE_TYPES[place.nature?.type] || '自然';
  const campusUses = { 'administrative-campus': '行政地点', 'administrative-research-site': '行政与研究', 'institution-reference': '学校参考位置', 'residential-campus': '住宿校区', 'pre-degree-campus': '大学预科校区', 'further-education-campus': '继续教育校区', 'further-education-teaching-site': '继续教育地点', 'education-transition-campus': '教学调整中', 'research-degree-site': '研究生研究地点' };
  if (place.category === 'university' && campusUses[place.university?.campusType]) return campusUses[place.university.campusType];
  if (place.category === 'university' && place.ranking?.provider === 'QS') return `QS #${place.ranking.rankDisplay}`;
  if (isBrandBuffet(place)) return '自助餐 · 品牌';
  if (place.category === 'restaurant' && place.dining?.service === 'self-select') return '自选冒菜';
  if (isVerifiedBuffet(place) && place.dining?.service === 'unlimited') return '不限量套餐';
  if (place.category === 'restaurant' && place.dining?.service === 'hybrid') return '自助吧＋桌边';
  if (place.category === 'restaurant' && place.dining?.service === 'table-service-unlimited') return '点单式自助';
  if (isVerifiedBuffet(place) && place.dining?.availability?.label) return `自助餐 · ${place.dining.availability.label}`;
  return place.category === 'restaurant' ? (isVerifiedBuffet(place) ? '自助餐' : cuisineLabel(place) || '餐饮') : (CATEGORIES[place.category]?.name || '景点');
}
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function formatDistance(km) { return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(1)} km`; }
export function normalize(text = '') { return text.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim(); }
export function searchPlaces(places, { center, radius = 25, category = 'all', query = '', saved = null, cuisine = 'all', buffetOnly = false, cityId = null, natureKind = 'all' }) {
  const needle = normalize(query);
  return places.map(p => ({ ...p, distance: distanceKm(center, p.position) }))
    .filter(p => p.distance <= radius && (category === 'all' || p.category === category)
      && (!cityId || p.city === cityId)
      && (category !== 'nature' || natureKind === 'all' || p.nature?.type === natureKind)
      && (category !== 'restaurant' || ((cuisine === 'all' || p.dining?.cuisines?.includes(cuisine)) && (!buffetOnly || hasBuffetService(p))))
      && (!saved || saved.has(p.id)) && (!needle || normalize([p.nameZh, p.nameEn, p.address, cuisineLabel(p), placeTypeLabel(p), ...(p.aliases || [])].join(' ')).includes(needle)))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}
export function searchBounds(center, radius) {
  const latDelta = radius / 110.574;
  const lngDelta = radius / (111.32 * Math.max(0.1, Math.cos(center.lat * Math.PI / 180)));
  return [center.lng - lngDelta, center.lat - latDelta, center.lng + lngDelta, center.lat + latDelta];
}
export function intersects(a, b) { return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]; }
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function googleSearch(place) {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', [place.nameEn, place.address, 'United Kingdom'].filter(Boolean).join(', '));
  if (place.googlePlaceId) url.searchParams.set('query_place_id', place.googlePlaceId);
  return url.href;
}
export function googleDirections(place, mode = 'walking') {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', place.entrance ? `${place.entrance.lat},${place.entrance.lng}` : [place.nameEn, place.address, 'United Kingdom'].filter(Boolean).join(', '));
  if (!place.entrance && place.googlePlaceId) url.searchParams.set('destination_place_id', place.googlePlaceId);
  url.searchParams.set('travelmode', mode);
  return url.href;
}
