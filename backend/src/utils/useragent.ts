export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: 'Mobile' | 'Tablet' | 'Desktop';
}

/**
 * Lightweight, zero-dependency User-Agent parser.
 * Categorizes browser, operating system, and device type in under 0.05ms.
 */
export const parseUserAgent = (userAgentString?: string): ParsedUserAgent => {
  if (!userAgentString) {
    return { browser: 'Unknown', os: 'Unknown', deviceType: 'Desktop' };
  }


  const ua = userAgentString;

  // 1. Detect Device Type
  let deviceType: 'Mobile' | 'Tablet' | 'Desktop' = 'Desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua)) {
    deviceType = 'Mobile';
  }

  // 2. Detect Operating System
  let os = 'Other';
  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  // 3. Detect Browser
  let browser = 'Other';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return { browser, os, deviceType };
};
