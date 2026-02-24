import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const FIDE_BASE = 'https://ratings.fide.com';
const PROBE_TIMEOUT_MS = 8_000;
const REQUEST_TIMEOUT_MS = 20_000;
const REPROBE_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes

/** Network error codes that indicate the proxy/route is dead */
const NETWORK_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ECONNABORTED',
]);

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

interface ProxyEntry {
  /** The raw URL, or null for a direct connection */
  url: string | null;
  /** Human-readable label used in log messages */
  label: string;
  /** Pre-built agent, or null for direct */
  agent: HttpsProxyAgent<string> | SocksProxyAgent | null;
}

@Injectable()
export class ProxyManagerService implements OnModuleInit {
  private readonly logger = new Logger(ProxyManagerService.name);
  private proxies: ProxyEntry[] = [];
  /** Index of the currently active proxy; -1 means "not yet determined" */
  private activeIndex = -1;
  private probing = false;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.loadProxies();
    // Probe immediately on startup (non-blocking)
    this.probe().catch(() => {});
    // Periodic re-probe in the background
    setInterval(() => this.probe().catch(() => {}), REPROBE_INTERVAL_MS);
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  private loadProxies(): void {
    const raw = (process.env.FIDE_PROXY_URLS ?? process.env.FIDE_PROXY_URL ?? '').trim();
    const parts = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Always try direct unless the user explicitly ordered a proxy-only list
    if (!parts.includes('direct')) parts.unshift('direct');

    this.proxies = parts
      .map((part): ProxyEntry => {
        if (part === 'direct') return { url: null, label: 'direct', agent: null };
        const agent = this.buildAgent(part);
        if (!agent) return null as unknown as ProxyEntry; // skip invalid
        return { url: part, label: part, agent };
      })
      .filter(Boolean);

    this.logger.log(
      `Proxy candidates: ${this.proxies.map(p => p.label).join(' → ')}`,
    );
  }

  private buildAgent(
    url: string,
  ): HttpsProxyAgent<string> | SocksProxyAgent | null {
    try {
      const protocol = new URL(url).protocol;
      if (protocol.startsWith('socks')) {
        this.logger.debug(`Building SOCKS agent for ${url}`);
        return new SocksProxyAgent(url);
      }
      this.logger.debug(`Building HTTPS agent for ${url}`);
      return new HttpsProxyAgent(url);
    } catch {
      this.logger.warn(`Invalid proxy URL "${url}" — skipping`);
      return null;
    }
  }

  // ─── Probing ──────────────────────────────────────────────────────────────

  /** Tests each proxy in order; activates the first that can reach FIDE. */
  async probe(): Promise<void> {
    if (this.probing) return;
    this.probing = true;
    this.logger.log('Probing FIDE connectivity…');

    for (let i = 0; i < this.proxies.length; i++) {
      const p = this.proxies[i];
      const worked = await this.testProxy(p, PROBE_TIMEOUT_MS);
      if (worked) {
        const changed = this.activeIndex !== i;
        this.activeIndex = i;
        this.probing = false;
        if (changed) {
          this.logger.log(`✓ Active proxy set to "${p.label}"`);
        }
        return;
      }
    }

    this.logger.error('All proxies failed to reach FIDE — will retry at next interval');
    this.probing = false;
  }

  /** Returns true if the given proxy can reach FIDE within timeoutMs */
  private async testProxy(p: ProxyEntry, timeoutMs: number): Promise<boolean> {
    const config = this.buildAxiosConfig(p, timeoutMs);
    // Use validateStatus so non-2xx (e.g. 403) still counts as reachable
    config.validateStatus = s => s < 600;
    try {
      const res = await axios.get(FIDE_BASE, config);
      this.logger.log(`  ✓ "${p.label}" → HTTP ${res.status}`);
      return true;
    } catch (err: any) {
      this.logger.warn(`  ✗ "${p.label}" → ${err?.message ?? err}`);
      return false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Label of the currently active proxy (for logging / health checks) */
  get activeLabel(): string {
    return this.activeEntry?.label ?? 'unknown';
  }

  /** True once a working proxy has been found */
  get isReady(): boolean {
    return this.activeIndex >= 0;
  }

  /** Status snapshot for the /health endpoint */
  getStatus(): { ready: boolean; activeProxy: string; candidates: string[] } {
    return {
      ready: this.isReady,
      activeProxy: this.activeLabel,
      candidates: this.proxies.map(p => p.label),
    };
  }

  /**
   * Makes a GET request to a FIDE URL via the active proxy.
   * On network errors it rotates to the next proxy and retries once,
   * also kicking off an async full re-probe so future requests benefit.
   */
  async fideGet(url: string): Promise<AxiosResponse<string>> {
    // If we haven't probed yet, do it now before the first real request
    if (!this.isReady) await this.probe();

    try {
      return await axios.get<string>(url, this.buildAxiosConfig(this.activeEntry, REQUEST_TIMEOUT_MS));
    } catch (err: any) {
      if (!this.isNetworkError(err)) throw err;

      const failedLabel = this.activeEntry.label;
      this.logger.warn(
        `Network error via "${failedLabel}" (${err.code ?? err.message}) — trying next proxy`,
      );

      // Remember which index failed and mark as unknown
      const failedIndex = this.activeIndex;
      this.activeIndex = -1;

      // Background full re-probe so future requests pick up the best proxy
      this.probe().catch(() => {});

      // Immediate retry with the next candidate in the list
      const nextIndex = (failedIndex + 1) % this.proxies.length;
      if (nextIndex === failedIndex || this.proxies.length <= 1) {
        // No alternative — re-throw
        throw err;
      }

      const next = this.proxies[nextIndex];
      this.logger.log(`Retrying "${url}" via "${next.label}"`);

      try {
        const res = await axios.get<string>(
          url,
          this.buildAxiosConfig(next, REQUEST_TIMEOUT_MS),
        );
        this.activeIndex = nextIndex;
        this.logger.log(`✓ Fallback to "${next.label}" succeeded`);
        return res;
      } catch (retryErr: any) {
        this.logger.error(`Fallback "${next.label}" also failed: ${retryErr?.message}`);
        throw err; // throw the original error for consistent messaging
      }
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private get activeEntry(): ProxyEntry {
    const idx = this.activeIndex >= 0 ? this.activeIndex : 0;
    return this.proxies[idx] ?? { url: null, label: 'direct', agent: null };
  }

  private buildAxiosConfig(entry: ProxyEntry, timeoutMs: number): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      timeout: timeoutMs,
      headers: BROWSER_HEADERS,
      maxRedirects: 5,
      responseType: 'text',
    };
    if (entry.agent) {
      config.httpAgent = entry.agent;
      config.httpsAgent = entry.agent;
      config.proxy = false as any; // prevent axios built-in proxy conflicting
    }
    return config;
  }

  private isNetworkError(err: any): boolean {
    if (NETWORK_ERROR_CODES.has(err?.code)) return true;
    if (err?.message && /timeout|ETIMEDOUT|ECONNREFUSED/i.test(err.message)) return true;
    return false;
  }
}
