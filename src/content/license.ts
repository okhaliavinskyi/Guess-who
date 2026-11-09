/**
 * Licenses accepted for bank photos, as written in Wikimedia Commons'
 * LicenseShortName: public domain, CC0, CC BY, CC BY-SA, and government open
 * licenses that allow commercial reuse with attribution (UK OGL, Korea KOGL
 * Type 1, India GODL). Non-commercial (NC), no-derivatives (ND), GFDL-only and
 * non-free files are rejected. Used by the image import script and the bank tests.
 *
 * The one exception is FAIR_USE: files that English Wikipedia hosts under its
 * non-free content policy (official artwork of fictional characters, and the few
 * people with no free photo on Commons), see fetch-images.ts.
 */
export const FAIR_USE = 'Fair use';

export function isAllowedLicense(license: string): boolean {
  const l = license.trim().toLowerCase();
  return (
    l === 'public domain' ||
    /^pd([- ]|$)/.test(l) ||
    l === 'cc0' ||
    l.startsWith('cc0 ') ||
    /^cc by(-sa)? \d(\.\d)?( [a-z-]+)?$/.test(l) ||
    // Commons tags: {{Attribution}}, Flickr Commons "No known restrictions", {{Copyrighted free use}}.
    l === 'attribution' ||
    l === 'no restrictions' ||
    l === 'copyrighted free use' ||
    /^ogl( v?\d(\.\d)?)?$/.test(l) ||
    l === 'kogl type 1' ||
    l === 'godl-india'
  );
}
