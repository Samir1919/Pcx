// Shared currency formatter for the storefront/public apps.
export function money(value) {
  if (value == null) return "Price on request";
  return `৳${Number(value).toLocaleString("en-BD")}`;
}
