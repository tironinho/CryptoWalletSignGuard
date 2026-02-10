export function normMethod(m: any) {
  return String(m || "").trim();
}

export function normMethodLower(m: any) {
  return normMethod(m).toLowerCase();
}

