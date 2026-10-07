export function getDisplayOrganizationName(name: string): string {
  return name.replace(/\s*\u00B7\s*/g, ' - ').replace(/\s{2,}/g, ' ').trim();
}
