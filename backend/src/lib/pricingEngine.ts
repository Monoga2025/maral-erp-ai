// backend/src/lib/pricingEngine.ts
/**
 * Motor de Precios, Márgenes y Políticas Comerciales (Inspirado en Odoo sale/pricelist)
 * Adaptado a la realidad comercial de MARAL TECNOLOGÍA Y COMUNICACIONES S.A.S.
 */

export interface PricingRule {
  category: string;
  defaultDiscount: number;
  minMarginPercent: number;
  maxDiscount: number;
}

export const CATEGORY_PRICING_RULES: Record<string, PricingRule> = {
  IMPORTADOR:    { category: 'IMPORTADOR',    defaultDiscount: 36, minMarginPercent: 20, maxDiscount: 42 },
  DISTRIBUIDOR:  { category: 'DISTRIBUIDOR',  defaultDiscount: 26, minMarginPercent: 25, maxDiscount: 32 },
  CLIENTE_FINAL: { category: 'CLIENTE_FINAL', defaultDiscount: 10, minMarginPercent: 35, maxDiscount: 15 },
  PROSPECTO:     { category: 'PROSPECTO',     defaultDiscount: 10, minMarginPercent: 30, maxDiscount: 15 },
};

export interface QuoteItemInput {
  productId: string;
  qty: number;
  unitPrice: number;
  cost: number;
  discount?: number;
}

export interface CalculatedItem {
  productId: string;
  qty: number;
  unitPrice: number;
  cost: number;
  discount: number;
  effectiveUnitPrice: number; // Precio unitario con descuento aplicado
  subtotal: number;           // effectiveUnitPrice * qty
  totalCost: number;          // cost * qty
  grossProfit: number;        // subtotal - totalCost
  marginPercent: number;      // ((subtotal - totalCost) / subtotal) * 100
  marginAlert: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface QuoteCalculationSummary {
  items: CalculatedItem[];
  subtotal: number;
  tax: number;
  total: number;
  totalCost: number;
  totalGrossProfit: number;
  weightedMarginPercent: number;
  isViable: boolean;
  criticalItemsCount: number;
}

/**
 * Redondeo financiero exacto a 2 decimales
 */
export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Evalúa la política de precios y descuento recomendado según categoría del cliente
 */
export function resolveClientPricingPolicy(clientCategory?: string | null): PricingRule {
  const normalized = (clientCategory || 'PROSPECTO').toUpperCase().trim();
  return CATEGORY_PRICING_RULES[normalized] ?? CATEGORY_PRICING_RULES.PROSPECTO;
}

/**
 * Calcula con precisión matemática los precios netos, márgenes y utilidades por línea
 */
export function calculateItemMarginAndPrice(item: QuoteItemInput): CalculatedItem {
  const qty = Math.max(1, item.qty);
  const discount = Math.max(0, Math.min(100, item.discount ?? 0));
  const unitPrice = Math.max(0, item.unitPrice);
  const cost = Math.max(0, item.cost);

  const effectiveUnitPrice = roundCurrency(unitPrice * (1 - discount / 100));
  const subtotal = roundCurrency(effectiveUnitPrice * qty);
  const totalCost = roundCurrency(cost * qty);
  const grossProfit = roundCurrency(subtotal - totalCost);

  const marginPercent = subtotal > 0
    ? roundCurrency((grossProfit / subtotal) * 100)
    : 0;

  let marginAlert: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (marginPercent < 15 || grossProfit < 0) {
    marginAlert = 'CRITICAL';
  } else if (marginPercent < 25) {
    marginAlert = 'WARNING';
  }

  return {
    productId: item.productId,
    qty,
    unitPrice,
    cost,
    discount,
    effectiveUnitPrice,
    subtotal,
    totalCost,
    grossProfit,
    marginPercent,
    marginAlert,
  };
}

/**
 * Calcula el resumen comercial completo de una cotización con margen ponderado
 */
export function calculateQuoteSummary(
  items: QuoteItemInput[],
  taxPercent: number = 0
): QuoteCalculationSummary {
  const calculatedItems = items.map(calculateItemMarginAndPrice);
  const subtotal = roundCurrency(calculatedItems.reduce((acc, it) => acc + it.subtotal, 0));
  const totalCost = roundCurrency(calculatedItems.reduce((acc, it) => acc + it.totalCost, 0));
  const tax = roundCurrency((subtotal * taxPercent) / 100);
  const total = roundCurrency(subtotal + tax);
  const totalGrossProfit = roundCurrency(subtotal - totalCost);

  const weightedMarginPercent = subtotal > 0
    ? roundCurrency((totalGrossProfit / subtotal) * 100)
    : 0;

  const criticalItemsCount = calculatedItems.filter(i => i.marginAlert === 'CRITICAL').length;

  return {
    items: calculatedItems,
    subtotal,
    tax,
    total,
    totalCost,
    totalGrossProfit,
    weightedMarginPercent,
    isViable: criticalItemsCount === 0 && weightedMarginPercent >= 18,
    criticalItemsCount,
  };
}

/**
 * Validación de vigencia y expiración de cotización
 */
export function isQuotationExpired(createdAt: Date, validityDays: number): {
  isExpired: boolean;
  expirationDate: Date;
  daysRemaining: number;
} {
  const expirationDate = new Date(createdAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffTime = expirationDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    isExpired: daysRemaining < 0,
    expirationDate,
    daysRemaining,
  };
}
