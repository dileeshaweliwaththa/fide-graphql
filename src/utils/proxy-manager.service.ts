import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as https from 'https';

const FIDE_BASE = 'https://ratings.fide.com';
const PROBE_TIMEOUT_MS = 6_000;
const REQUEST_TIMEOUT_MS = 15_000;
const REPROBE_INTERVAL_MS = 5 * 60 * 1_000;

const NETWORK_ERROR_CODES = new Set([
  'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ECONNABORTED',
]);

// Accept gzip/br so the server sends compressed HTML — less bytes over the wire
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
};

interface ProxyEntry {
  url: string | null;
  label: string;
  agent: HttpsProxyAgent<string> | SocksProxyAgent | https.Agent | null;
}

@Injectable()
export class ProxyManagerService implements OnModuleInit {
  private readonly logger = new Logger(ProxyManagerService.name);
  private proxies: ProxyEntry[] = [];
  private activeIndex = -1;
  private probing = false;

  /**
   * In-flight request deduplication:
   * If two callers ask for the same URL simultaneously only one HTTP request
   * is made; both callers receive the same resolved value.
   */
  private readonly inflight = new Map<string, Promise<AxiosResponse<string>>>();

  /**
   * Persistent keep-alive agent for direct (non-proxy) connections.
   * Reuses TCP/TLS connections across requests — eliminates handshake latency.
   */
  private readonly directAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 10,
    maxFreeSockets: 5,
    timeout: REQUEST_TIMEOUT_MS,
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.loadProxies();
    this.probe().catch(() => {});
    setInterval(() => this.probe().catch(() => {}), REPROBE_INTERVAL_MS);
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  private loadProxies(): void {
    const raw = (process.env.FIDE_PROXY_URLS ?? process.env.FIDE_PROXY_URL ?? '').trim();
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);

    if (!parts.includes('direct')) parts.unshift('direct');

    this.proxies = parts
      .map((part): ProxyEntry | null => {
        if (part === 'direct') return { url: null, label: 'direct', agent: null };
        const agent = this.buildAgent(part);
        if (!agent) return null;
        return { url: part, label: part, agent };
      })
      .filter((e): e is ProxyEntry => e !== null);

    this.logger.log(`Proxy candidates: ${this.proxies.map(p => p.label).join(' → ')}`);
  }

  private buildAgent(url: string): HttpsProxyAgent<string> | SocksProxyAgent | null {
    try {
      const protocol = new URL(url).protocol;
      // Pass keepAlive so the proxy agent also reuses connections
      if (protocol.startsWith('socks')) {
        return new SocksProxyAgent(url, { keepAlive: true, maxSockets: 10 });
      }
      return new HttpsProxyAgent(url, { keepAlive: true, maxSockets: 10 });
    } catch {
      this.logger.warn(`Invalid proxy URL "${url}" — skipping`);
      return null;
    }
  }

  // ─── Probing ──────────────────────────────────────────────────────────────

  async probe(): Promise<void> {
    if (this.probing) return;
    this.probing = true;
    this.logger.log('Probing FIDE connectivity…');

    for (let i = 0; i < this.proxies.length; i++) {
      const worked = await this.testProxy(this.proxies[i]);
      if (worked) {
        const changed = this.activeIndex !== i;
        this.activeIndex = i;
        this.probing = false;
        if (changed) this.logger.log(`✓ Active proxy → "${this.proxies[i].label}"`);
        return;
      }
    }

    this.logger.error('All proxies failed — will retry at next interval');
    this.probing = false;
  }

  /**
   * Use HEAD instead of GET for probing — server sends only headers,
   * so the probe is ~10× faster and uses almost no bandwidth.
   */
  private async testProxy(p: ProxyEntry): Promise<boolean> {
    const config = this.buildAxiosConfig(p, PROBE_TIMEOUT_MS);
    config.validateStatus = s => s < 600;
    try {
      const res = await axios.head(FIDE_BASE, config);
      this.logger.log(`  ✓ "${p.label}" → ${res.status}`);
      return true;
    } catch (err: any) {
      this.logger.warn(`  ✗ "${p.label}" → ${err?.message ?? err}`);
      return false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  get activeLabel(): string { return this.activeEntry.label; }
  get isReady(): boolean { return this.activeIndex >= 0; }

  getStatus(): { ready: boolean; activeProxy: string; candidates: string[] } {
    return {
      ready: this.isReady,
      activeProxy: this.activeLabel,
      candidates: this.proxies.map(p => p.label),
    };
  }

  /**
   * Fetches a FIDE URL with:
   *  1. Request deduplication  — concurrent identical URLs share one request
   *  2. Automatic proxy rotation on network failure
   *  3. Background re-probe after any failure
   */
  async fideGet(url: string): Promise<AxiosResponse<string>> {
    if (!this.isReady) await this.probe();

    // Dedup: if the same URL is already in-flight, piggyback on it
    const existing = this.inflight.get(url);
    if (existing) return existing;

    const promise = this._doGet(url).finally(() => this.inflight.delete(url));
    this.inflight.set(url, promise);
    return promise;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async _doGet(url: string): Promise<AxiosResponse<string>> {
    try {
      return await axios.get<string>(url, this.buildAxiosConfig(this.activeEntry, REQUEST_TIMEOUT_MS));
    } catch (err: any) {
      if (!this.isNetworkError(err)) throw err;

      const failedIndex = this.activeIndex;
      this.logger.warn(`Network error via "${this.activeEntry.label}" (${err.code ?? err.message}) — rotating`);
      this.activeIndex = -1;
      this.probe().catch(() => {}); // background full re-probe

      const nextIndex = (failedIndex + 1) % this.proxies.length;
      if (nextIndex === failedIndex || this.proxies.length <= 1) throw err;

      const next = this.proxies[nextIndex];
      this.logger.log(`Retrying via "${next.label}"`);
      try {
        const res = await axios.get<string>(url, this.buildAxiosConfig(next, REQUEST_TIMEOUT_MS));
        this.activeIndex = nextIndex;
        return res;
      } catch {
        throw err;
      }
    }
  }

  private get activeEntry(): ProxyEntry {
    return this.proxies[this.activeIndex >= 0 ? this.activeIndex : 0] ??
           { url: null, label: 'direct', agent: null };
  }

  private buildAxiosConfig(entry: ProxyEntry, timeoutMs: number): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      timeout: timeoutMs,
      headers: BROWSER_HEADERS,
      maxRedirects: 5,
      responseType: 'text',
      decompress: true, // auto-decompress gzip/br responses
    };

    if (entry.agent) {
      // Proxy agent (SOCKS/HTTPS) — disable axios's own proxy logic
      config.httpAgent = entry.agent;
      config.httpsAgent = entry.agent;
      config.proxy = false as any;
    } else {
      // Direct connection — use the persistent keep-alive agent
      config.httpsAgent = this.directAgent;
    }

    return config;
  }

  private isNetworkError(err: any): boolean {
    if (NETWORK_ERROR_CODES.has(err?.code)) return true;
    if (err?.message && /timeout|ETIMEDOUT|ECONNREFUSED/i.test(err.message)) return true;
    return false;
  }
}
