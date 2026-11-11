import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export interface CheckOutcome {
  up: boolean;
  statusCode?: number;
  responseTimeMs: number;
  error?: string;
}

// Good-enough block list. A production system would use a vetted library.
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return (
      v === "::" ||
      v === "::1" ||
      v.startsWith("::ffff:") || // IPv4-mapped
      /^fe[89ab]/.test(v) || // link-local fe80::/10
      /^f[cd]/.test(v) || // unique local fc00::/7
      v.startsWith("ff") // multicast
    );
  }
  return true; // unknown format: block
}

// Validates the address that is actually used to connect, which also
// defends against DNS rebinding (a name that resolves to a public IP
// during a pre-check and to a private IP when connecting).
export const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      callback(err, address, family);
      return;
    }
    const addresses = Array.isArray(address)
      ? address.map((entry) => entry.address)
      : [address];
    const blocked = addresses.find(isPrivateAddress);
    if (blocked) {
      callback(new Error(`blocked address ${blocked}`) as NodeJS.ErrnoException, address, family);
      return;
    }
    callback(null, address, family);
  });
};

// IP literals skip DNS lookup entirely, so they need their own check.
function assertSafeTarget(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("unsupported protocol");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isPrivateAddress(host)) {
    throw new Error(`blocked address ${host}`);
  }
}

function requestOnce(
  url: URL,
  signal: AbortSignal
): Promise<{ statusCode: number; location?: string }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        signal,
        agent: false,
        headers: { "user-agent": "uptime-monitor/0.1" },
      },
      (res) => {
        resolve({ statusCode: res.statusCode ?? 0, location: res.headers.location });
        res.destroy(); // we only need the headers, not the body
      }
    );
    req.on("error", reject);
    req.end();
  });
}

export async function checkUrl(rawUrl: string, expectedStatus: number): Promise<CheckOutcome> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  try {
    let url = new URL(rawUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertSafeTarget(url);
      const { statusCode, location } = await requestOnce(url, signal);

      if (statusCode === expectedStatus) {
        return { up: true, statusCode, responseTimeMs: elapsed() };
      }
      if (statusCode >= 300 && statusCode < 400 && location) {
        url = new URL(location, url); // every hop is re-validated
        continue;
      }
      return {
        up: false,
        statusCode,
        responseTimeMs: elapsed(),
        error: `unexpected status ${statusCode}`,
      };
    }
    return { up: false, responseTimeMs: elapsed(), error: "too many redirects" };
  } catch (err) {
    return {
      up: false,
      responseTimeMs: elapsed(),
      error: signal.aborted ? "timeout" : (err as Error).message,
    };
  }
}
