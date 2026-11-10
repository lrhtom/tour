import { searchBounds, intersects } from './core.js?v=20261110-nature-8';
export class PlacesStore {
  constructor() { this.cache = new Map(); this.index = null; }
  async init() {
    const indexUrl = new URL('../data/index.js', import.meta.url);
    indexUrl.search = new URL(import.meta.url).search;
    indexUrl.searchParams.set('fresh', Math.floor(Date.now() / 60000));
    const { default: index } = await import(indexUrl);
    this.index = index;
    return this.index;
  }
  async nearby(center, radius) {
    const bounds = searchBounds(center, radius);
    const shards = this.index.shards.filter(s => intersects(s.bounds, bounds));
    return this.loadShards(shards);
  }
  async all() { return this.loadShards(this.index.shards); }
  async city(cityId) {
    const shards = this.index.shards.filter(s => !s.cities || s.cities.includes(cityId));
    return (await this.loadShards(shards)).filter(p => p.city === cityId);
  }
  async loadShards(shards) {
    const batches = [];
    // Bound concurrency instead of launching all nationwide requests at once.
    for (let i = 0; i < shards.length; i += 6) {
      batches.push(...await Promise.all(shards.slice(i, i + 6).map(async shard => {
        if (!this.cache.has(shard.file)) {
          const shardUrl = new URL(`../data/${shard.file}`, import.meta.url);
          shardUrl.searchParams.set('v', this.index.revision);
          const promise = import(shardUrl).then(module => module.default);
          this.cache.set(shard.file, promise);
          promise.catch(() => this.cache.delete(shard.file));
        }
        return this.cache.get(shard.file);
      })));
    }
    return [...new Map(batches.flat().map(p => [p.id, p])).values()];
  }
}
