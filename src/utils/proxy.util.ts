import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

/**
 * Builds a Node http.Agent for proxying FIDE HTTP requests.
 *
 * Set FIDE_PROXY_URL in your environment to enable:
 *   HTTP/HTTPS proxy  → http://host:port  or  https://host:port
 *   SOCKS4/5 proxy    → socks4://host:port  or  socks5://host:port
 *
 * When unset, returns null and axios sends requests directly.
 */
export function buildFideProxyAgent(): HttpsProxyAgent<string> | SocksProxyAgent | null {
  const proxyUrl = process.env.FIDE_PROXY_URL?.trim();

  if (!proxyUrl) {
    console.log('[FideProxy] FIDE_PROXY_URL not set — connecting directly (no proxy)');
    return null;
  }

  let protocol: string;
  try {
    protocol = new URL(proxyUrl).protocol;
  } catch {
    console.warn(`[FideProxy] FIDE_PROXY_URL is not a valid URL ("${proxyUrl}") — ignoring proxy`);
    return null;
  }

  if (protocol.startsWith('socks')) {
    console.log(`[FideProxy] Using SOCKS proxy → ${proxyUrl}`);
    return new SocksProxyAgent(proxyUrl);
  }

  console.log(`[FideProxy] Using HTTPS proxy → ${proxyUrl}`);
  return new HttpsProxyAgent(proxyUrl);
}
