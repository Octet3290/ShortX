import { isIP } from 'net';

/**
 * Validates whether a destination URL is safe to shorten.
 * Protects against Server-Side Request Forgery (SSRF), internal port scanning,
 * cloud metadata exfiltration, and malicious protocols (javascript:, file:, data:).
 */
export function isSafeDestinationUrl(urlString: string): { isValid: boolean; reason?: string } {
  let parsed: URL;

  try {
    parsed = new URL(urlString);
  } catch {
    return { isValid: false, reason: 'Malformed URL structure' };
  }

  // 1. Enforce strict HTTP/HTTPS protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      reason: `Disallowed protocol '${parsed.protocol}'. Only http: and https: are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 2. Reject empty hostname
  if (!hostname) {
    return { isValid: false, reason: 'Hostname cannot be empty' };
  }

  // 3. Reject localhost, 0.0.0.0, and loopbacks
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return {
      isValid: false,
      reason: 'SSRF Protection: Redirecting to localhost or loopback addresses is prohibited.',
    };
  }

  // 4. Reject Cloud Metadata service endpoints (AWS, GCP, Azure, DigitalOcean)
  if (
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata.local' ||
    hostname === 'instance-data'
  ) {
    return {
      isValid: false,
      reason: 'SSRF Protection: Redirecting to cloud metadata services is prohibited.',
    };
  }

  // 5. Check for Obfuscated Decimal/Hex IPs (e.g. http://2130706433 which evaluates to 127.0.0.1)
  if (/^\d+$/.test(hostname)) {
    return {
      isValid: false,
      reason: 'SSRF Protection: Obfuscated numeric IP addresses are prohibited.',
    };
  }
  if (/^0x[0-9a-fA-F]+$/.test(hostname)) {
    return {
      isValid: false,
      reason: 'SSRF Protection: Obfuscated hexadecimal IP addresses are prohibited.',
    };
  }

  // 6. Check IPv4 / IPv6 addresses for private subnets
  // Handle brackets if IPv6
  const cleanIp = hostname.replace(/^\[|\]$/g, '');
  const ipType = isIP(cleanIp);

  if (ipType === 4) {
    const parts = cleanIp.split('.').map((p) => parseInt(p, 10));
    const [b0, b1] = parts;

    // Loopback (127.0.0.0/8)
    if (b0 === 127) {
      return {
        isValid: false,
        reason: 'SSRF Protection: Loopback IPv4 addresses (127.x.x.x) are prohibited.',
      };
    }

    // RFC 1918 Private Subnets:
    // 10.0.0.0/8
    if (b0 === 10) {
      return {
        isValid: false,
        reason: 'SSRF Protection: Private network IPv4 addresses (10.x.x.x) are prohibited.',
      };
    }

    // 172.16.0.0/12 (172.16.0.0 – 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) {
      return {
        isValid: false,
        reason: 'SSRF Protection: Private network IPv4 addresses (172.16-31.x.x) are prohibited.',
      };
    }

    // 192.168.0.0/16
    if (b0 === 192 && b1 === 168) {
      return {
        isValid: false,
        reason: 'SSRF Protection: Private network IPv4 addresses (192.168.x.x) are prohibited.',
      };
    }

    // Link-local / APIPA (169.254.0.0/16)
    if (b0 === 169 && b1 === 254) {
      return {
        isValid: false,
        reason: 'SSRF Protection: Link-local IPv4 addresses (169.254.x.x) are prohibited.',
      };
    }

    // Carrier-Grade NAT (100.64.0.0/10)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) {
      return {
        isValid: false,
        reason: 'SSRF Protection: Carrier-grade NAT IPv4 addresses are prohibited.',
      };
    }

    // Reserved / Broadcast (0.x.x.x or 255.255.255.255)
    if (b0 === 0 || b0 === 255) {
      return {
        isValid: false,
        reason: 'SSRF Protection: Reserved IPv4 addresses are prohibited.',
      };
    }
  } else if (ipType === 6) {
    const lower = cleanIp.toLowerCase();
    // Loopback, unique local (fc00::/7), or link-local (fe80::/10)
    if (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    ) {
      return {
        isValid: false,
        reason: 'SSRF Protection: Private or Loopback IPv6 addresses are prohibited.',
      };
    }
  }

  return { isValid: true };
}
