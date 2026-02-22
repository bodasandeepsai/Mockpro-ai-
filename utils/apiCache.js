/**
 * Advanced API Response Cache with LRU eviction and intelligent TTL
 * Optimized for Gemini free tier rate limits
 */

class APICache {
  constructor(maxSize = 50, defaultTTL = 3600000) { // 1 hour default
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.accessOrder = []; // LRU tracking
    this.pendingRequests = new Map(); // Request deduplication
  }

  /**
   * Generate cache key from parameters
   * Uses hash to keep keys compact
   */
  generateKey(...params) {
    const str = JSON.stringify(params);
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `cache_${Math.abs(hash)}`;
  }

  /**
   * Get value from cache if not expired
   */
  get(key) {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (entry.expiresAt > Date.now()) {
        // Update LRU
        this.updateAccessOrder(key);
        if ((process.env.DEBUG_CACHE || "") === "1") {
          console.log(`[Cache HIT] ${key}`);
        }
        return entry.value;
      } else {
        // Expired
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
      }
    }
    return null;
  }

  /**
   * Set value in cache with TTL
   */
  set(key, value, ttl = this.defaultTTL) {
    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lruKey = this.accessOrder.shift();
      this.cache.delete(lruKey);
      if ((process.env.DEBUG_CACHE || "") === "1") {
        console.log(`[Cache EVICT] ${lruKey}`);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });

    this.updateAccessOrder(key);
    if ((process.env.DEBUG_CACHE || "") === "1") {
      console.log(`[Cache SET] ${key} TTL=${ttl}ms`);
    }
  }

  /**
   * Update LRU access order
   */
  updateAccessOrder(key) {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  /**
   * Deduplicate concurrent requests
   * Returns promise that resolves when request completes
   */
  async deduplicate(key, requestFn) {
    if (this.pendingRequests.has(key)) {
      if ((process.env.DEBUG_CACHE || "") === "1") {
        console.log(`[Cache DEDUP] Waiting for existing request: ${key}`);
      }
      return this.pendingRequests.get(key);
    }

    const promise = requestFn()
      .finally(() => {
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Clear expired entries
   */
  prune() {
    const now = Date.now();
    let pruned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        pruned++;
      }
    }

    if (pruned > 0 && (process.env.DEBUG_CACHE || "") === "1") {
      console.log(`[Cache PRUNE] Removed ${pruned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      pendingRequests: this.pendingRequests.size,
      utilization: `${Math.round((this.cache.size / this.maxSize) * 100)}%`,
    };
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.pendingRequests.clear();
    if ((process.env.DEBUG_CACHE || "") === "1") {
      console.log("[Cache CLEAR] All entries cleared");
    }
  }
}

// Singleton instances per cache type
const questionCache = new APICache(30, 86400000); // 24 hours for questions
const feedbackCache = new APICache(100, 3600000); // 1 hour for feedback

module.exports = {
  APICache,
  questionCache,
  feedbackCache,
};
