import * as ML from '../vendor/maplibre/maplibre-gl.js';
import { PMTiles, Protocol } from '../vendor/pmtiles.js';
import { ChunkedArchiveSource } from './archive.js';
import { CATEGORIES, formatDistance } from './core.js';
import { readStaticAsset } from './static-assets.js';

function pinImage(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 72; canvas.height = 92;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.shadowColor = '#20212440'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
  ctx.fillStyle = color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(18, 43); ctx.bezierCurveTo(15, 38, 3, 27, 3, 18); ctx.arc(18, 18, 15, Math.PI, 0); ctx.bezierCurveTo(33, 27, 21, 38, 18, 43); ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(18, 18, 6, 0, Math.PI * 2); ctx.fill();
  return ctx.getImageData(0, 0, 72, 92);
}
export class TravelMap {
  constructor({ onSelect, onMove, onReady, onError }) {
    this.onSelect = onSelect; this.onMove = onMove; this.onReady = onReady; this.onError = onError;
    this.places = []; this.selected = null; this.loaded = false; this.labels = true; this.visible = true;
  }
  async init(city) {
    const mapRoot = new URL('../maps/', import.meta.url);
    const [{ default: manifest }, { default: originalStyle }] = await Promise.all([import(new URL('manifest.js', mapRoot)), import(new URL('style.js', mapRoot))]);
    const style = structuredClone(originalStyle);
    this.manifest = manifest;
    const source = new ChunkedArchiveSource(manifest, mapRoot);
    this.protocol = new Protocol();
    this.protocol.add(new PMTiles(source));
    ML.addProtocol('pmtiles', this.protocol.tile);
    ML.addProtocol('localasset', readStaticAsset);
    ML.setWorkerUrl(new URL('../vendor/maplibre/maplibre-gl-worker.js', import.meta.url).href);
    style.sources.basemap.url = `pmtiles://${source.getKey()}`;
    style.glyphs = `localasset://local${mapRoot.pathname}fonts/{fontstack}/{range}.pbf`;
    style.sprite = `localasset://local${mapRoot.pathname}sprites/light`;
    this.map = new ML.Map({ container: 'map', style, center: [city.lng, city.lat], zoom: city.zoom,
      minZoom: 4, maxZoom: 18, maxBounds: [[-11, 48.5], [4, 62.5]], attributionControl: false,
      dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: false,
      localIdeographFontFamily: 'Arial, Microsoft YaHei, sans-serif', fadeDuration: 150,
    });
    this.adjustPadding();
    window.addEventListener('resize', () => this.adjustPadding());
    this.map.addControl(new ML.AttributionControl({ compact: false }), 'bottom-right');
    this.map.addControl(new ML.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-left');
    let errorReported = false;
    this.map.on('error', e => { if (!errorReported && !e.error?.message?.includes('glyph')) { errorReported = true; this.onError(e.error); } });
    this.map.on('load', () => {
      for (const [name, category] of Object.entries(CATEGORIES)) if (name !== 'all') this.map.addImage(`pin-${name}`, pinImage(category.color), { pixelRatio: 2 });
      this.map.addSource('attractions', { type: 'geojson', data: this.featureCollection(), cluster: true, clusterRadius: 37, clusterMaxZoom: 12 });
      this.map.addLayer({ id: 'clusters', type: 'circle', source: 'attractions', filter: ['has', 'point_count'], paint: { 'circle-color': '#1a73e8', 'circle-radius': 17, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3, 'circle-opacity': 0.95 } });
      this.map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'attractions', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff' } });
      this.map.addLayer({ id: 'selected-halo', type: 'circle', source: 'attractions', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': 23, 'circle-color': '#1a73e8', 'circle-opacity': 0.14, 'circle-translate': [0, -24] } });
      this.map.addLayer({ id: 'place-pins', type: 'symbol', source: 'attractions', filter: ['!', ['has', 'point_count']], layout: { 'icon-image': ['concat', 'pin-', ['get', 'category']], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-size': ['case', ['==', ['get', 'id'], this.selected || ''], 1.15, 0.85] } });
      this.map.on('click', 'place-pins', event => { const id = event.features?.[0]?.properties.id; if (id) this.onSelect(id); });
      this.map.on('click', 'clusters', async event => {
        const feature = event.features[0];
        const zoom = await this.map.getSource('attractions').getClusterExpansionZoom(feature.properties.cluster_id);
        this.map.easeTo({ center: feature.geometry.coordinates, zoom: zoom + 0.1 });
      });
      for (const layer of ['place-pins', 'clusters']) {
        this.map.on('mouseenter', layer, () => this.map.getCanvas().style.cursor = 'pointer');
        this.map.on('mouseleave', layer, () => this.map.getCanvas().style.cursor = '');
      }
      this.loaded = true;
      this.setPlaces(this.places);
      this.setLabels(this.labels);
      this.setVisible(this.visible);
      if (this.selected) this.select(this.selected, false);
      this.map.once('idle', () => { document.body.dataset.mapReady = 'true'; this.onReady(); });
    });
    this.map.on('moveend', () => { const p = this.map.getCenter(); this.onMove({ lat: p.lat, lng: p.lng }); });
    return this;
  }
  featureCollection() { return { type: 'FeatureCollection', features: this.places.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.position.lng, p.position.lat] }, properties: { id: p.id, category: CATEGORIES[p.category] ? p.category : 'attraction' } })) }; }
  setPlaces(places) { this.places = places; if (this.loaded) this.map.getSource('attractions').setData(this.featureCollection()); }
  flyTo(position, zoom = 13) { this.map?.flyTo({ center: [position.lng, position.lat], zoom, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700 }); }
  select(id, fly = true) {
    this.selected = id;
    if (!this.loaded) return;
    this.map.setFilter('selected-halo', ['==', ['get', 'id'], id || '']);
    this.map.setLayoutProperty('place-pins', 'icon-size', ['case', ['==', ['get', 'id'], id || ''], 1.15, 0.85]);
    this.popup?.remove();
    const place = this.places.find(p => p.id === id);
    if (!place) return;
    const content = document.createElement('div');
    const title = document.createElement('p'); title.className = 'map-popup-title'; title.textContent = place.nameZh || place.nameEn;
    const meta = document.createElement('p'); meta.className = 'map-popup-meta'; meta.textContent = `${CATEGORIES[place.category]?.name || '景点'} · ${formatDistance(place.distance || 0)}`;
    content.append(title, meta);
    this.popup = new ML.Popup({ closeButton: false, offset: 42, maxWidth: '210px' }).setLngLat([place.position.lng, place.position.lat]).setDOMContent(content).addTo(this.map);
    if (fly) this.flyTo(place.position, Math.max(14, this.map.getZoom()));
  }
  userPosition(position, accuracy) {
    if (!this.map) return;
    const element = document.createElement('div');
    element.style.cssText = 'width:15px;height:15px;border:3px solid white;border-radius:50%;background:#4285f4;box-shadow:0 0 0 9px #4285f426,0 1px 5px #20212440';
    element.title = `定位精度约 ${Math.round(accuracy)} 米`;
    this.userMarker?.remove();
    this.userMarker = new ML.Marker({ element }).setLngLat([position.lng, position.lat]).addTo(this.map);
  }
  zoom(delta) { this.map?.zoomTo(this.map.getZoom() + delta, { duration: 250 }); }
  north() { this.map?.resetNorth({ duration: 300 }); }
  adjustPadding() {
    if (!this.map) return;
    const mobile = matchMedia('(max-width: 760px)').matches;
    const bottom = mobile ? Math.min(document.getElementById('sidebar').getBoundingClientRect().height, innerHeight - 145) : 0;
    this.map.setPadding({ top: mobile ? 132 : 0, bottom: Math.max(0, bottom), left: 0, right: 0 });
  }
  setLabels(visible) { this.labels = visible; if (this.loaded) for (const layer of this.map.getStyle().layers) if (layer.type === 'symbol' && layer.source === 'basemap') this.map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none'); }
  setVisible(visible) { this.visible = visible; if (this.loaded) for (const id of ['clusters', 'cluster-count', 'place-pins', 'selected-halo']) this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); if (!visible) this.popup?.remove(); }
}
