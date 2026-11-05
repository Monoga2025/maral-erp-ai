// backend/src/lib/stockEngine.ts
/**
 * Motor de Inventario, Reservas y Despachos Parciales (Inspirado en Odoo stock/delivery)
 * Adaptado a la logística de telecomunicaciones de MARAL OS
 */

export interface CarrierMetadata {
  name: string;
  trackingUrlBuilder?: (guide: string) => string;
}

export const CARRIERS_CONFIG: Record<string, CarrierMetadata> = {
  COORDINADORA: {
    name: 'Coordinadora Mercantil',
    trackingUrlBuilder: (g) => `https://www.coordinadora.com/portafolio-de-servicios/rastreo-de-guias/?guia=${encodeURIComponent(g)}`,
  },
  SERVIENTREGA: {
    name: 'Servientrega',
    trackingUrlBuilder: (g) => `https://www.servientrega.com/wps/portal/rastreo-envio?id=${encodeURIComponent(g)}`,
  },
  ENVIA: {
    name: 'Envía Colvanes',
    trackingUrlBuilder: (g) => `https://sientrada.envia.co/seguimiento/${encodeURIComponent(g)}`,
  },
  INTERRAPIDISIMO: {
    name: 'Inter Rapidísimo',
    trackingUrlBuilder: (g) => `https://www.interrapidisimo.com/sigue-tu-envio/?guia=${encodeURIComponent(g)}`,
  },
  TCC: {
    name: 'Transportadora Comercial Colombia (TCC)',
    trackingUrlBuilder: (g) => `https://tcc.com.co/rastreo/?guia=${encodeURIComponent(g)}`,
  },
};

/**
 * 1. Algoritmo de Reglas de Reorden Automático (Odoo stock.warehouse.orderpoint)
 * Calcula el stock pronosticado considerando existencias a mano, reservas y compras en camino
 */
export function computeReorder(
  physical: number,
  reserved: number,
  incoming: number,
  min: number,
  max: number,
  multiple: number = 1
): { triggered: boolean; forecasted: number; qtyToOrder: number } {
  // Fórmula Odoo: Forecasted = Physical - Reserved + Incoming
  const forecasted = physical - reserved + incoming;
  const mult = Math.max(1, multiple);
  const targetMax = max > min ? max : min * 2;

  if (forecasted <= min) {
    const rawNeeded = targetMax - forecasted;
    const batches = Math.ceil(rawNeeded / mult);
    return {
      triggered: true,
      forecasted,
      qtyToOrder: Math.max(mult, batches * mult),
    };
  }

  return { triggered: false, forecasted, qtyToOrder: 0 };
}

/**
 * 2. Lógica de Partición de Despachos y Generación de Backorders (Odoo stock.backorder.confirmation)
 */
export interface ItemState {
  orderItemId: string;
  orderedQty: number;
  shippedQty: number;
}

export interface DispatchInput {
  orderItemId: string;
  dispatchQty: number;
}

export function simulateDispatch(
  itemsState: ItemState[],
  dispatchDraft: DispatchInput[]
): {
  updatedState: ItemState[];
  hasBackorder: boolean;
  backorderItems: Array<{ orderItemId: string; pendingQty: number }>;
  orderStatus: 'DESPACHADO' | 'DESPACHO_PARCIAL';
} {
  const updatedState = itemsState.map((i) => ({ ...i }));
  const backorderItems: Array<{ orderItemId: string; pendingQty: number }> = [];

  for (const d of dispatchDraft) {
    const target = updatedState.find((i) => i.orderItemId === d.orderItemId);
    if (!target) throw new Error('ITEM_NOT_FOUND');
    const remaining = target.orderedQty - target.shippedQty;
    if (d.dispatchQty > remaining) throw new Error('QUANTITY_EXCEEDED');

    target.shippedQty += d.dispatchQty;
  }

  for (const item of updatedState) {
    const pending = item.orderedQty - item.shippedQty;
    if (pending > 0) {
      backorderItems.push({ orderItemId: item.orderItemId, pendingQty: pending });
    }
  }

  const allShipped = updatedState.every((i) => i.shippedQty >= i.orderedQty);
  const orderStatus = allShipped ? 'DESPACHADO' : 'DESPACHO_PARCIAL';

  return {
    updatedState,
    hasBackorder: backorderItems.length > 0,
    backorderItems,
    orderStatus,
  };
}

/**
 * 3. Constructor de URLs de Rastreo de Envíos
 */
export function buildTrackingUrl(carrier: string, trackingNumber?: string): string | null {
  if (!trackingNumber) return null;
  const cleanNumber = trackingNumber.trim();
  if (!cleanNumber) return null;

  const key = carrier.toUpperCase().trim();
  const conf = CARRIERS_CONFIG[key];
  if (conf?.trackingUrlBuilder) {
    return conf.trackingUrlBuilder(cleanNumber);
  }
  return null;
}
