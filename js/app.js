import { CITIES, CATEGORIES, CUISINES, searchPlaces, formatDistance, googleSearch, googleDirections, distanceKm, safeUrl, isVerifiedBuffet, cuisineLabel, placeTypeLabel } from './core.js';
import { icon, mountIcons } from './icons.js';
import { PlacesStore } from './data.js';
import { TravelMap } from './map.js';

const $ = id => document.getElementById(id);
const node = (tag, className = '', text) => { const el = document.createElement(tag); el.className = className; if (text !== undefined) el.textContent = text; return el; };
const state = { city: CITIES[0], center: CITIES[0], radius: 25, category: 'all', cuisine: 'all', buffetOnly: false, universityNationwide: true, universityQsOnly: false, universities: [], query: '', mode: 'explore', places: [], results: [], selected: null, saved: new Map(), loadId: 0, lockUntil: 0 };
try { for (const p of JSON.parse(localStorage.getItem('uk-nearby-saved-v1') || '[]')) if (p?.id && p?.position && Number.isFinite(p.position.lat) && Number.isFinite(p.position.lng) && p.nameEn) state.saved.set(p.id, p); } catch {}
const store = new PlacesStore();
let toastTimer, searchTimer;
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 3800); }
const map = new TravelMap({
  onSelect: id => selectPlace(id),
  onMove: center => { state.mapCenter = center; if (Date.now() > state.lockUntil && distanceKm(center, state.center) > 0.3) $('search-area').hidden = false; },
  onReady: () => $('map-message').hidden = true,
  onError: error => { $('map-message').title = error?.message || ''; document.body.dataset.mapError = error?.message || 'unknown'; console.warn('Map load:', error?.message); $('map-message').replaceChildren(document.createTextNode('地图暂未加载')); const retry = node('button', '', '重试'); retry.style.color = '#1a73e8'; retry.addEventListener('click', () => location.reload()); $('map-message').append(retry); },
});
mountIcons();
for (const city of CITIES) { const option = node('option', '', city.name); option.value = city.id; $('city').append(option); }
const customCenterOption = node('option', '', '地图选点'); customCenterOption.value = 'custom'; customCenterOption.disabled = true; customCenterOption.hidden = true; $('city').append(customCenterOption);
for (const [key, label] of Object.entries(CUISINES)) { const option = node('option', '', label); option.value = key; $('cuisine').append(option); }
function fitFilteredPlaces() { state.lockUntil = Date.now() + 1200; map.fitPlaces(state.results); }
let universitiesTask;
async function loadUniversities() {
  if (!universitiesTask) universitiesTask = (async () => {
    if (!store.index) await store.init();
    state.universities = (await store.all()).filter(place => place.category === 'university');
  })().catch(error => { universitiesTask = null; throw error; });
  return universitiesTask;
}
for (const button of $('university-filters').querySelectorAll('[data-university-scope]')) button.addEventListener('click', async () => {
  state.universityNationwide = button.dataset.universityScope === 'uk'; closeDetail();
  if (state.universityNationwide) { try { await loadUniversities(); } catch { toast('大学数据暂时无法加载，请重试'); } }
  render(); fitFilteredPlaces();
});
$('university-qs').addEventListener('click', () => { state.universityQsOnly = !state.universityQsOnly; closeDetail(); render(); fitFilteredPlaces(); });
$('cuisine').addEventListener('change', () => { state.cuisine = $('cuisine').value; closeDetail(); render(); fitFilteredPlaces(); });
$('buffet-filter').addEventListener('click', () => { state.buffetOnly = !state.buffetOnly; closeDetail(); render(); fitFilteredPlaces(); });
for (const [key, category] of Object.entries(CATEGORIES)) {
  if (key === 'attraction') continue;
  const button = node('button', `category-chip${key === 'all' ? ' active' : ''}`);
  button.type = 'button'; button.dataset.category = key; button.setAttribute('aria-pressed', String(key === 'all'));
  button.append(icon(category.icon), node('span', '', category.filterName || category.name));
  button.addEventListener('click', async () => {
    state.category = key; closeDetail();
    if (key !== 'restaurant') { state.cuisine = 'all'; state.buffetOnly = false; }
    $('categories').querySelectorAll('button').forEach(b => { const active = b.dataset.category === key; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    if (key === 'university') {
      skeleton();
      try { await loadUniversities(); } catch { toast('大学数据暂时无法加载，请重试'); }
    }
    render();
    if (state.category === key && key !== 'all') fitFilteredPlaces();
  });
  $('categories').append(button);
}
function skeleton() { $('results').replaceChildren(...Array.from({ length: 5 }, () => { const row = node('div', 'skeleton'); row.setAttribute('aria-hidden', 'true'); const copy = node('div'); copy.append(node('span'), node('span')); row.append(node('span'), copy); return row; })); }
async function loadPlaces() {
  const loadId = ++state.loadId;
  $('results').setAttribute('aria-busy', 'true'); skeleton();
  try {
    const places = state.radius === 'all' && state.city ? await store.city(state.city.id) : await store.nearby(state.center, Number(state.radius));
    if (loadId !== state.loadId) return;
    state.places = places;
    for (const place of places) if (state.saved.has(place.id)) state.saved.set(place.id, place);
    render();
  } catch (error) {
    if (loadId !== state.loadId) return;
    $('results').replaceChildren(emptyState('暂时无法加载', '请检查网络后重试', () => loadPlaces(), '重试'));
    $('results-meta').textContent = '加载失败'; toast(error.message);
  } finally { if (loadId === state.loadId) $('results').setAttribute('aria-busy', 'false'); }
}
async function refreshSavedPlaces() {
  const saved = [...state.saved.values()];
  for (let i = 0; i < saved.length; i += 6) {
    const batches = await Promise.allSettled(saved.slice(i, i + 6).map(place => store.nearby(place.position, 0)));
    for (const batch of batches) if (batch.status === 'fulfilled') {
      for (const place of batch.value) if (state.saved.has(place.id)) state.saved.set(place.id, place);
    }
  }
  if (saved.length) {
    try { localStorage.setItem('uk-nearby-saved-v1', JSON.stringify([...state.saved.values()])); } catch {}
    if (state.mode === 'saved') render();
  }
}
function emptyState(title, description, action, label) {
  const el = node('div', 'empty-state'); el.append(icon(state.mode === 'saved' ? 'bookmark' : 'search'), node('h2', '', title), node('p', '', description));
  if (action) { const button = node('button', '', label); button.addEventListener('click', action); el.append(button); }
  return el;
}
function bookmarkButton(place, className = '') {
  const button = node('button', `icon-button bookmark-button ${className}`); button.type = 'button';
  const saved = state.saved.has(place.id); button.classList.toggle('saved', saved); button.setAttribute('aria-label', `${saved ? '取消收藏' : '收藏'}${place.nameZh || place.nameEn}`); button.setAttribute('aria-pressed', String(saved)); button.title = saved ? '取消收藏' : '收藏';
  button.append(icon(saved ? 'bookmark-filled' : 'bookmark'));
  button.addEventListener('click', event => { event.stopPropagation(); toggleSaved(place); });
  return button;
}
function toggleSaved(place) {
  if (state.saved.has(place.id)) state.saved.delete(place.id); else state.saved.set(place.id, place);
  try { localStorage.setItem('uk-nearby-saved-v1', JSON.stringify([...state.saved.values()])); } catch { toast('当前浏览器无法保存收藏'); }
  renderSavedCount(); render();
  if (state.selected) { const selected = [...state.results, ...state.saved.values()].find(p => p.id === state.selected); if (selected) renderDetail(selected); else closeDetail(); }
}
function renderSavedCount() { const count = state.saved.size; $('saved-count').hidden = !count; $('saved-count').textContent = count; }
function makeCard(place) {
  const category = CATEGORIES[place.category] || CATEGORIES.attraction;
  const card = node('article', `place-card${state.selected === place.id ? ' selected' : ''}`);
  card.dataset.id = place.id; card.tabIndex = 0; card.setAttribute('aria-label', `${place.nameZh || place.nameEn}，${category.name}，${formatDistance(place.distance)}`);
  const avatar = node('div', 'place-avatar'); avatar.style.setProperty('--place-color', category.color); avatar.style.setProperty('--place-tint', `${category.color}0e`); avatar.append(icon(category.icon));
  const copy = node('div', 'place-copy'); copy.append(node('h2', '', place.nameZh || place.nameEn));
  if (place.nameZh) copy.append(node('p', 'place-english', place.nameEn)); else copy.append(node('p', 'place-english', place.nation || 'United Kingdom'));
  const meta = node('div', 'place-meta'); meta.append(node('span', '', placeTypeLabel(place)), node('span', 'meta-dot', '·'), node('span', '', formatDistance(place.distance))); copy.append(meta);
  const route = node('a', 'place-route'); route.href = googleDirections(place); route.target = '_blank'; route.rel = 'noopener noreferrer'; route.title = '在 Google 地图中查看路线'; route.setAttribute('aria-label', `前往${place.nameZh || place.nameEn}的路线`); route.append(icon('route')); route.addEventListener('click', e => e.stopPropagation());
  card.append(avatar, copy, bookmarkButton(place), route);
  card.addEventListener('click', () => selectPlace(place.id));
  card.addEventListener('keydown', e => { if (e.target === card && ['Enter', ' '].includes(e.key)) { e.preventDefault(); selectPlace(place.id); } });
  return card;
}
function render() {
  const nationwide = state.mode !== 'saved' && state.category === 'university' && state.universityNationwide;
  let source = state.mode === 'saved' ? [...state.saved.values()] : nationwide ? state.universities : state.places;
  if (state.category === 'university' && state.universityQsOnly) source = source.filter(place => place.ranking?.provider === 'QS' && place.ranking.globalRank <= 600);
  const wholeCity = !nationwide && state.mode !== 'saved' && state.radius === 'all' && state.city;
  state.results = searchPlaces(source, { center: state.center, radius: state.mode === 'saved' || wholeCity || nationwide ? Infinity : Number(state.radius), cityId: wholeCity ? state.city.id : null, query: state.query, category: state.category, cuisine: state.cuisine, buffetOnly: state.buffetOnly });
  $('dining-filters').hidden = state.category !== 'restaurant' || Boolean(state.selected);
  $('cuisine').value = state.cuisine;
  $('buffet-filter').classList.toggle('active', state.buffetOnly);
  $('buffet-filter').setAttribute('aria-pressed', String(state.buffetOnly));
  $('university-filters').hidden = state.category !== 'university' || state.mode === 'saved' || Boolean(state.selected);
  $('university-filters').querySelectorAll('[data-university-scope]').forEach(button => {
    const active = (button.dataset.universityScope === 'uk') === state.universityNationwide;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  $('university-qs').classList.toggle('active', state.universityQsOnly);
  $('university-qs').setAttribute('aria-pressed', String(state.universityQsOnly));
  $('results-title').textContent = state.mode === 'saved' ? '我的收藏' : nationwide ? '英国大学' : state.city ? `探索${state.city.name}` : '探索附近';
  const institutions = new Set(state.results.map(place => place.university?.institutionId || place.id));
  $('results-meta').textContent = state.category === 'university' ? `${institutions.size} 所学校 · ${state.results.length} 个位置` : `${state.results.length} 个地点 · 按距离排序`;
  $('radius').disabled = state.mode === 'saved';
  $('radius').closest('.radius-select').hidden = nationwide;
  $('radius').querySelector('[value="all"]').disabled = !state.city;
  $('clear-search').hidden = !state.query;
  const fragment = document.createDocumentFragment();
  if (!state.results.length) fragment.append(emptyState(state.mode === 'saved' ? '还没有收藏的地点' : '没有找到地点', state.mode === 'saved' ? '点击书签，留住想去的地方' : '试试其他分类或扩大范围', () => {
    if (state.mode === 'saved') setMode('explore');
    else { state.query = ''; $('search').value = ''; state.category = 'all'; $('categories').querySelector('[data-category="all"]').click(); state.radius = 50; $('radius').value = '50'; loadPlaces(); }
  }, state.mode === 'saved' ? '去探索' : '重新搜索'));
  else fragment.append(...state.results.slice(0, 250).map(makeCard));
  if (state.results.length > 250) fragment.append(node('p', 'detail-note', '已显示最近 250 处，请缩小范围查看。'));
  $('results').replaceChildren(fragment);
  map.setPlaces(state.results);
}
function actionLink(text, name, url, primary = false) { const link = node('a', `detail-action${primary ? ' primary' : ''}`); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.append(icon(name), node('span', '', text)); return link; }
function detailRow(name, content) { const row = node('div', 'detail-row'); row.append(icon(name), typeof content === 'string' ? node('span', '', content) : content); return row; }
function renderDetail(place) {
  const category = CATEGORIES[place.category] || CATEGORIES.attraction;
  const back = node('button', 'detail-back'); back.append(icon('arrow-left'), node('span', '', '返回列表')); back.addEventListener('click', closeDetail);
  const cover = node('div', 'detail-cover'); cover.style.setProperty('--place-color', category.color); cover.style.setProperty('--place-tint', `${category.color}0e`); cover.append(icon(category.icon));
  const body = node('div', 'detail-body'); body.append(node('h2', '', place.nameZh || place.nameEn));
  if (place.nameZh) body.append(node('p', 'detail-en', place.nameEn));
  const typeLabel = [place.category === 'university' ? '大学' : placeTypeLabel(place), isVerifiedBuffet(place) ? cuisineLabel(place) : null].filter(Boolean).join(' · ');
  body.append(node('p', 'detail-category', `${typeLabel} · ${formatDistance(place.distance || 0)}`));
  const actions = node('div', 'detail-actions');
  const save = node('button', 'detail-action'); const saved = state.saved.has(place.id); save.append(icon(saved ? 'bookmark-filled' : 'bookmark'), node('span', '', saved ? '已收藏' : '收藏')); save.addEventListener('click', () => toggleSaved(place)); save.setAttribute('aria-pressed', String(saved));
  actions.append(actionLink('路线', 'route', googleDirections(place), true), save, actionLink('Google 地图', 'external', googleSearch(place)));
  body.append(actions);
  if (place.highlight && place.category !== 'university') body.append(detailRow(category.icon, place.highlight));
  const rankUrl = safeUrl(place.ranking?.sourceUrl);
  if (place.category === 'university' && rankUrl) {
    const link = node('a', '', `QS ${place.ranking.edition} · #${place.ranking.rankDisplay}（学校整体）`); link.href = rankUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    body.append(detailRow('university', link));
  }
  if (place.university?.campusName) body.append(detailRow('university', place.university.campusName));
  if (isVerifiedBuffet(place)) {
    const proof = place.dining.buffetVerification;
    const link = node('a', '', '自助餐 · 官网已核验'); link.href = safeUrl(proof.sourceUrl); link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.title = `${proof.checkedAt} · ${proof.excerpt}`;
    body.append(detailRow('info', link));
  }
  if (place.visitNote) {
    const visitUrl = safeUrl(place.visitInfoUrl || place.website);
    if (visitUrl) {
      const link = node('a', '', place.visitNote); link.href = visitUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
      body.append(detailRow('info', link));
    } else body.append(detailRow('info', place.visitNote));
  }
  if (place.address) body.append(detailRow('pin', place.address));
  const website = safeUrl(place.website);
  if (website) { const link = node('a', '', new URL(website).hostname.replace(/^www\./, '')); link.href = website; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(detailRow('globe', link)); }
  const copy = node('button', '', `${place.position.lat.toFixed(6)}, ${place.position.lng.toFixed(6)}`); copy.style.cssText = 'padding:0;color:#5f6368;text-align:left'; copy.title = '复制坐标'; copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(`${place.position.lat}, ${place.position.lng}`); toast('坐标已复制'); } catch { toast('当前浏览器不支持复制'); } }); body.append(detailRow('copy', copy));
  const sourceUrl = place.sourceUrls?.map(safeUrl).find(Boolean);
  if (sourceUrl) { const link = node('a', '', place.sourceLabel || (place.sourceIds?.wikidata ? 'Wikidata' : 'OpenStreetMap')); link.href = sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; body.append(detailRow('info', link)); }
  body.append(node('p', 'detail-note', place.position.kind === 'campus-reference' ? '校区参考位置，入口未核验。' : place.position.kind === 'area-reference' ? '区域参考位置，出发前请查看官网。' : place.entrance ? '路线以已核验入口为目的地。' : '入口未核验，出发前请查看官网。'));
  $('detail').replaceChildren(back, cover, body);
}
function selectPlace(id) {
  const place = state.results.find(p => p.id === id);
  if (!place) return;
  state.selected = id; state.lockUntil = Date.now() + 1200;
  renderDetail(place); $('detail').hidden = false; $('results').hidden = true; $('results-heading').hidden = true;
  $('dining-filters').hidden = true;
  $('university-filters').hidden = true;
  map.select(id); setSheet('normal');
}
function closeDetail() { state.selected = null; $('detail').hidden = true; $('results').hidden = false; $('results-heading').hidden = false; $('dining-filters').hidden = state.category !== 'restaurant'; $('university-filters').hidden = state.category !== 'university' || state.mode === 'saved'; map.select(null, false); }
function setMode(mode) {
  state.mode = mode; closeDetail(); state.query = ''; $('search').value = '';
  for (const [id, active] of [['nav-explore', mode === 'explore'], ['nav-saved', mode === 'saved']]) { $(id).classList.toggle('active', active); $(id).setAttribute('aria-pressed', String(active)); }
  $('mobile-saved').setAttribute('aria-pressed', String(mode === 'saved')); $('mobile-saved').classList.toggle('active', mode === 'saved');
  render(); setSheet('normal');
}
async function changeCenter(position, city = null, label = '地图选点') {
  closeDetail(); state.center = position; state.city = city; state.lockUntil = Date.now() + 1200; state.query = ''; $('search').value = ''; state.mode = 'explore';
  $('nav-explore').classList.add('active'); $('nav-saved').classList.remove('active'); $('nav-explore').setAttribute('aria-pressed', 'true'); $('nav-saved').setAttribute('aria-pressed', 'false');
  if (city) $('city').value = city.id;
  else { customCenterOption.textContent = label; $('city').value = 'custom'; }
  $('mobile-saved').setAttribute('aria-pressed', 'false'); $('mobile-saved').classList.remove('active');
  if (state.category === 'university') state.universityNationwide = false;
  map.flyTo(position, city?.zoom || 13); $('search-area').hidden = true;
  if (!city && state.radius === 'all') { state.radius = 25; $('radius').value = '25'; }
  await loadPlaces();
  if (state.radius === 'all') fitFilteredPlaces();
}
function submitSearch() {
  const query = $('search').value.trim();
  const city = CITIES.find(c => c.name === query || c.en.toLowerCase() === query.toLowerCase());
  if (city) changeCenter(city, city);
  else { state.query = query; closeDetail(); render(); }
}
async function locate() {
  if (!navigator.geolocation) { toast('此浏览器不支持定位，请选择城市'); return; }
  for (const id of ['locate','locate-inline']) $(id).disabled = true;
  navigator.geolocation.getCurrentPosition(async result => {
    const position = { lat: result.coords.latitude, lng: result.coords.longitude };
    try {
      if (position.lat < 49.8 || position.lat > 61 || position.lng < -8.7 || position.lng > 2) toast('当前位置在英国以外，请选择目的地城市');
      else { map.userPosition(position, result.coords.accuracy); await changeCenter(position, null, '我的位置'); toast(`已定位，精度约 ${Math.round(result.coords.accuracy)} 米`); }
    } finally { for (const id of ['locate','locate-inline']) $(id).disabled = false; }
  }, error => {
    for (const id of ['locate','locate-inline']) $(id).disabled = false;
    toast(error.code === 1 ? '未获得定位权限，请选择城市' : error.code === 3 ? '定位超时，请重试或选择城市' : '暂时无法定位，请选择城市');
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}
function setSheet(mode) {
  $('sidebar').classList.toggle('collapsed', mode === 'collapsed'); $('sidebar').classList.toggle('expanded', mode === 'expanded');
  document.body.classList.toggle('sheet-collapsed', mode === 'collapsed'); document.body.classList.toggle('sheet-expanded', mode === 'expanded');
  $('mobile-view-label').textContent = mode === 'collapsed' ? '列表' : '地图';
  $('mobile-view').firstElementChild?.replaceWith(icon(mode === 'collapsed' ? 'list' : 'map'));
  setTimeout(() => map.adjustPadding(), 260);
}
$('city').addEventListener('change', () => { const city = CITIES.find(c => c.id === $('city').value); changeCenter(city, city); });
$('radius').addEventListener('change', async () => { state.radius = $('radius').value === 'all' ? 'all' : Number($('radius').value); closeDetail(); await loadPlaces(); if (state.radius === 'all') fitFilteredPlaces(); });
$('search-form').addEventListener('submit', e => { e.preventDefault(); clearTimeout(searchTimer); submitSearch(); });
$('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(submitSearch, 180); });
$('clear-search').addEventListener('click', () => { $('search').value = ''; state.query = ''; closeDetail(); render(); $('search').focus(); });
$('nav-explore').addEventListener('click', () => setMode('explore')); $('nav-saved').addEventListener('click', () => setMode('saved'));
$('mobile-saved').addEventListener('click', () => setMode(state.mode === 'saved' ? 'explore' : 'saved'));
for (const id of ['locate','locate-inline']) $(id).addEventListener('click', locate);
$('zoom-in').addEventListener('click', () => map.zoom(1)); $('zoom-out').addEventListener('click', () => map.zoom(-1)); $('reset-north').addEventListener('click', () => map.north());
$('search-area').addEventListener('click', () => { if (state.mapCenter) changeCenter(state.mapCenter); });
$('layers-button').addEventListener('click', () => { $('layers-popover').hidden = !$('layers-popover').hidden; $('layers-button').setAttribute('aria-expanded', String(!$('layers-popover').hidden)); });
$('show-labels').addEventListener('change', e => map.setLabels(e.target.checked)); $('show-places').addEventListener('change', e => map.setVisible(e.target.checked));
$('sheet-handle').addEventListener('click', () => setSheet($('sidebar').classList.contains('expanded') ? 'normal' : 'expanded'));
$('mobile-view').addEventListener('click', () => setSheet($('sidebar').classList.contains('collapsed') ? 'normal' : 'collapsed'));
for (const id of ['about-button','data-button']) $(id).addEventListener('click', () => $('about-dialog').showModal());
$('close-about').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', e => { if (e.target === $('about-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDetail(); $('layers-popover').hidden = true; $('layers-button').setAttribute('aria-expanded', 'false'); } if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); $('search').focus(); } });
renderSavedCount(); skeleton();
const mapTask = map.init(CITIES[0]).catch(error => { $('map-message').replaceChildren(document.createTextNode(error.message || '地图暂时无法显示')); console.error(error); });
try {
  const index = await store.init();
  $('coverage-label').textContent = index.coverage.sample ? '首批收录' : '开放景点数据';
  const info = $('dataset-info');
  for (const [key, value] of [['已收录', `${index.count} 个地点`], ['覆盖', index.coverage.sample ? '英国部分景点' : '按开放数据规则提取'], ['更新', new Date(index.generatedAt).toLocaleDateString('zh-CN')]]) info.append(node('dt', '', key), node('dd', '', value));
  await loadPlaces();
  await refreshSavedPlaces();
  document.body.dataset.appReady = 'true';
} catch (error) {
  $('results').replaceChildren(emptyState('景点加载失败', '请检查网络后重试', () => location.reload(), '重新加载')); $('results').setAttribute('aria-busy', 'false'); $('results-meta').textContent = '暂时无法加载'; console.error(error);
}
