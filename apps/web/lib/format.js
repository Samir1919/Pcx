// Shared currency formatter for the storefront/public apps.
export function money(value) {
  if (value == null) return "Price on request";
  return `৳${Number(value).toLocaleString("en-BD")}`;
}

const GRADES = {
  A_PLUS: "A+",
  A: "A",
  B: "B",
  C: "C",
  REJECT: "Reject"
};

// Server-owned condition grade codes get a human label (A_PLUS -> "A+").
export function gradeLabel(grade) {
  return grade ? (GRADES[grade] ?? grade) : "Not graded";
}
