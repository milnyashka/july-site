type PurchaseErrorDict = Record<string, string>;

export function purchaseErrorMessage(
  code: string | undefined,
  errors: PurchaseErrorDict,
  fallback: string
): string {
  if (!code) return fallback;
  return errors[code] ?? fallback;
}