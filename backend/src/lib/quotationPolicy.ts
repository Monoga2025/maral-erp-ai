type QuotationLine = { productId: string; qty: number; unitPrice: number; discount?: number }

export function calculateQuotationTotals<T extends { qty: number; unitPrice: number; discount?: number }>(items: T[], taxPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * (1 - (item.discount ?? 0) / 100) * item.qty, 0)
  const tax = subtotal * taxPercent / 100
  return { subtotal, tax, total: subtotal + tax }
}

export function buildQuotationItemData<T extends QuotationLine>(item: T) {
  const { productId, qty, unitPrice, discount = 0 } = item
  return { productId, qty, unitPrice, discount, subtotal: unitPrice * (1 - discount / 100) * qty }
}

export function withoutTaxPercent<T extends { taxPercent?: unknown }>(data: T): Omit<T, 'taxPercent'> {
  const { taxPercent: _taxPercent, ...persisted } = data
  return persisted
}

export function nextQuotationNumber(lastNumber: number | null): number {
  return Math.max((lastNumber ?? 0) + 1, 945)
}
