/**
 * SSRF DNS-rebinding guard for provider HTTP clients.
 *
 * A custom provider baseUrl passes string validation at config time
 * (ProviderConfig.create), but a hostname like `api.evil.com` may resolve to
 * `127.0.0.1` or `169.254.169.254` at request time (DNS rebinding). This guard
 * resolves the hostname via node:dns and revalidates the resolved IP against
 * the domain SSRF policy immediately before the provider client is constructed.
 *
 * Belongs in @wolfkrow/infra (NOT domain) because it performs I/O (dns.lookup).
 */

import * as dns from 'node:dns'

import { isSsrfBlockedHost } from '@wolfkrow/domain'

/**
 * Returns true when the hostname is already a literal IP or a dev-loopback
 * alias — no DNS resolution needed (already validated at config time, or
 * explicitly permitted for local development).
 */
function isLiteralHost(hostname: string): boolean {
  if (hostname === 'localhost') return true
  // IPv4 literal (dotted decimal, already canonicalized by URL)
  if (/^\d{1,3}(\.\d{1,3}){1,3}$/.test(hostname)) return true
  // IPv6 literal (with or without brackets)
  if (hostname.startsWith('[') || hostname.includes(':')) return true
  return false
}

/**
 * Resolves `baseUrl`'s hostname and rejects if the resolved IP is private or
 * loopback (DNS rebinding defense). Literal IP / localhost hostnames skip
 * resolution (already gated by ProviderConfig validation).
 *
 * DNS failures are treated as non-fatal (resolve) to avoid a DoS vector where
 * an attacker forces NXDOMAIN to block legitimate provider creation.
 */
export async function assertPublicProviderHost(baseUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    // Malformed URL — let the SDK surface the error; not an SSRF concern here.
    return
  }

  const hostname = parsed.hostname
  if (isLiteralHost(hostname)) return

  let address: string
  try {
    const result = await dns.promises.lookup(hostname)
    address = typeof result === 'string' ? result : result.address
  } catch {
    // DNS resolution failed — not an SSRF signal; allow construction to proceed
    // and let the HTTP client surface the connection error.
    return
  }

  if (isSsrfBlockedHost(address)) {
    throw new Error(
      `SSRF guard: baseUrl host "${hostname}" resolved to private/blocked address ${address}`,
    )
  }
}
