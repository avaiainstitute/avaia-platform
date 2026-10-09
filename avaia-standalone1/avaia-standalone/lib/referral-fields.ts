// Reading a referral field into a list, for the Workbook's read-only roll-ups ("Next right steps", Lessons, etc).
//
// A referral's fields are not all the same shape: some are lists of strings (for example `restorationTargets`),
// but `nextStep` and `whatToPreserve` are a single string in the InnerCompass referral schema, and older stored
// referrals may hold `whatToPreserve` as a list. The roll-ups must accept both. A non-string, non-list value is
// ignored, and an empty or blank string yields nothing. Pure and display-only: nothing is stored or changed.

/** An array gives its string items, a non-empty string is a one-item list, anything else is ignored. */
export function listFromField(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return [];
}
