import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuotationItemData, calculateQuotationTotals, nextQuotationNumber, withoutTaxPercent } from './quotationPolicy.ts'

test('new quotation applies discount once, zero IVA, and strips calculation-only taxPercent', () => {
  const items = [{ productId: 'p1', qty: 1, unitPrice: 100, discount: 31 }]
  const totals = calculateQuotationTotals(items, 0)
  assert.deepEqual(totals, { subtotal: 69, tax: 0, total: 69 })
  assert.deepEqual(buildQuotationItemData(items[0]), {
    productId: 'p1', qty: 1, unitPrice: 100, discount: 31, subtotal: 69,
  })
  assert.deepEqual(withoutTaxPercent({ paymentTerms: 'Contado', taxPercent: 0 }), { paymentTerms: 'Contado' })
})

test('folio allocation starts at 4585 and never moves behind the highest existing number', () => {
  assert.equal(nextQuotationNumber(null), 4585)
  assert.equal(nextQuotationNumber(4584), 4585)
  assert.equal(nextQuotationNumber(4585), 4586)
  assert.equal(nextQuotationNumber(5000), 5001)
})
