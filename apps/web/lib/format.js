// Shared currency formatter for the storefront/public apps.
export function money(value) {
  if (value == null) return "Price on request";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
