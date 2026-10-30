import { test } from 'node:test'
import assert from 'node:assert/strict'
import router from './quotations'
import prisma from '../lib/prisma'
import { buildQuotationItemData, calculateQuotationTotals, nextQuotationNumber } from '../lib/quotationPolicy'

const item = { productId: 'p1', qty: 1, unitPrice: 100, discount: 31 }

test('POST controller persists an accepted taxPercent request without taxPercent and locks before create in its transaction', async () => {
  const original = { transaction: prisma.$transaction, activity: prisma.activityLog.create, create: prisma.quotation.create, find: prisma.quotation.findFirst }
  let createData: any
  let lockSql = ''
  let inTransaction = false
  const tx: any = {
    $queryRaw: async (parts: TemplateStringsArray) => { lockSql = parts.join('?'); return [{ locked: true }] },
    quotation: {
      findFirst: async () => { assert.equal(inTransaction, true); return { number: 944 } },
      create: async ({ data }: any) => { assert.equal(inTransaction, true); createData = data; return { ...data, id: 'q-test', clientId: 'c-test', number: data.number } },
    },
  }
  ;(prisma as any).$transaction = async (callback: (tx: any) => Promise<any>) => { inTransaction = true; try { return await callback(tx) } finally { inTransaction = false } }
  ;(prisma as any).activityLog.create = async () => ({})
  const layer: any = (router as any).stack.find((entry: any) => entry.route?.path === '/' && entry.route?.methods.post)
  const handler = layer.route.stack.at(-1).handle
  const result = responseRecorder()
  try {
    await handler({ body: { clientId: 'c-test', taxPercent: 0, items: [item] }, user: { userId: 'u-test' } }, result.res)
    assert.equal(result.statusCode, 201)
    assert.match(lockSql, /pg_advisory_xact_lock/)
    assert.match(lockSql, /IS NULL/)
    assert.equal(createData.number, 945)
    assert.equal('taxPercent' in createData, false)
    assert.deepEqual({ subtotal: createData.subtotal, tax: createData.tax, total: createData.total }, { subtotal: 69, tax: 0, total: 69 })
    assert.deepEqual(createData.items.create[0], { ...buildQuotationItemData(item) })
  } finally {
    ;(prisma as any).$transaction = original.transaction
    ;(prisma as any).activityLog.create = original.activity
  }
})

test('PUT notes-only controller update preserves existing stored monetary values', async () => {
  const original = { transaction: prisma.$transaction, find: prisma.quotation.findUnique, update: prisma.quotation.update }
  let updateData: any
  ;(prisma as any).quotation.findUnique = async () => ({ id: 'q-legacy', subtotal: 100, tax: 19, total: 119, items: [] })
  ;(prisma as any).$transaction = async (callback: (tx: any) => Promise<any>) => callback({
    quotationItem: { deleteMany: async () => ({ count: 0 }) },
    quotation: { update: async ({ data }: any) => { updateData = data; return { id: 'q-legacy', ...data } } },
  })
  const layer: any = (router as any).stack.find((entry: any) => entry.route?.path === '/:id' && entry.route?.methods.put)
  const handler = layer.route.stack.at(-1).handle
  const result = responseRecorder()
  try {
    await handler({ params: { id: 'q-legacy' }, body: { notes: 'nota' } }, result.res)
    assert.equal(result.statusCode, 200)
    assert.deepEqual(updateData, { notes: 'nota', followUpDate: undefined })
  } finally {
    ;(prisma as any).$transaction = original.transaction
    ;(prisma as any).quotation.findUnique = original.find
  }
})

test('line persistence discounts once, zero-tax totals, and folio floor', () => {
  assert.deepEqual(buildQuotationItemData(item), { productId: 'p1', qty: 1, unitPrice: 100, discount: 31, subtotal: 69 })
  assert.deepEqual(calculateQuotationTotals([item], 0), { subtotal: 69, tax: 0, total: 69 })
  assert.equal(String(nextQuotationNumber(null)).padStart(5, '0'), '00945')
  assert.equal(nextQuotationNumber(5000), 5001)
})

function responseRecorder() {
  const result: { statusCode: number; body: unknown; res: any } = {
    statusCode: 200,
    body: undefined,
    res: undefined,
  }
  result.res = {
    status(code: number) { result.statusCode = code; return this },
    json(body: unknown) { result.body = body; return this },
  }
  return result
}
