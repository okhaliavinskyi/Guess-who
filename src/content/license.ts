/**
 * Licenses accepted for bank photos: public domain, CC0, CC BY and CC BY-SA
 * (as written in Wikimedia Commons' LicenseShortName). Used by the image import
 * script and by the bank tests.
 */
export function isAllowedLicense(license: string): boolean {
  const l = license.trim().toLowerCase();
  return (
    l === 'public domain' ||
    /^pd([- ]|$)/.test(l) ||
    l === 'cc0' ||
    l.startsWith('cc0 ') ||
    /^cc by(-sa)? \d(\.\d)?( [a-z-]+)?$/.test(l)
  );
}
