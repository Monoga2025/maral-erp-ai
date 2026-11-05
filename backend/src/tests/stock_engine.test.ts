// backend/src/tests/stock_engine.test.ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReorder,
  simulateDispatch,
  buildTrackingUrl,
  CARRIERS_CONFIG,
  type ItemState,
} from '../lib/stockEngine.ts';

describe('Stock & Logistics Engine Suite (Odoo stock/delivery REA)', () => {
  // ─── 1. Pronóstico y Reorden ───
  test('1. Stock físico alto pero reservas masivas disparan reposición inmediata', () => {
    // Físico: 20, Reservado: 18, Incoming: 0, Min: 5, Max: 30, Múltiplo: 5
    const res = computeReorder(20, 18, 0, 5, 30, 5);
    // Pronosticado = 20 - 18 + 0 = 2 (menor que min=5)
    assert.equal(res.forecasted, 2);
    assert.equal(res.triggered, true);
    // Necesidad bruta = 30 - 2 = 28. Redondeado a múltiplo de 5 => 30
    assert.equal(res.qtyToOrder, 30);
  });

  test('2. Órdenes de compra entrantes evitan compras duplicadas innecesarias', () => {
    // Físico: 3, Reservas: 2, Incoming: 25, Min: 5, Max: 30, Múltiplo: 1
    const res = computeReorder(3, 2, 25, 5, 30, 1);
    // Pronosticado = 3 - 2 + 25 = 26 (mayor que min=5)
    assert.equal(res.forecasted, 26);
    assert.equal(res.triggered, false);
    assert.equal(res.qtyToOrder, 0);
  });

  test('3. Quiebre total de inventario (Stock pronosticado negativo)', () => {
    // Físico: 5, Reservas: 15, Incoming: 0, Min: 10, Max: 40, Múltiplo: 10
    const res = computeReorder(5, 15, 0, 10, 40, 10);
    assert.equal(res.forecasted, -10);
    assert.equal(res.triggered, true);
    // Necesidad = 40 - (-10) = 50. Múltiplo de 10 => 50 exactos
    assert.equal(res.qtyToOrder, 50);
  });

  test('4. Stock estable por encima del mínimo no dispara orden', () => {
    const res = computeReorder(50, 10, 0, 20, 60, 5);
    // Forecasted = 40 > 20
    assert.equal(res.forecasted, 40);
    assert.equal(res.triggered, false);
    assert.equal(res.qtyToOrder, 0);
  });

  // ─── 2. Partición de Despachos y Backorders ───
  test('5. Despacho parcial genera backorder con remanente exacto y estado DESPACHO_PARCIAL', () => {
    const initialItems: ItemState[] = [
      { orderItemId: 'item-1', orderedQty: 10, shippedQty: 0 },
      { orderItemId: 'item-2', orderedQty: 5,  shippedQty: 0 },
    ];

    const result = simulateDispatch(initialItems, [
      { orderItemId: 'item-1', dispatchQty: 6 },
      { orderItemId: 'item-2', dispatchQty: 5 },
    ]);

    assert.equal(result.orderStatus, 'DESPACHO_PARCIAL');
    assert.equal(result.hasBackorder, true);
    assert.equal(result.backorderItems.length, 1);
    assert.equal(result.backorderItems[0].orderItemId, 'item-1');
    assert.equal(result.backorderItems[0].pendingQty, 4);
  });

  test('6. Despacho subsiguiente del backorder liquida la orden y no genera nuevo backorder', () => {
    const intermediateItems: ItemState[] = [
      { orderItemId: 'item-1', orderedQty: 10, shippedQty: 6 },
      { orderItemId: 'item-2', orderedQty: 5,  shippedQty: 5 },
    ];

    const result = simulateDispatch(intermediateItems, [
      { orderItemId: 'item-1', dispatchQty: 4 },
    ]);

    assert.equal(result.orderStatus, 'DESPACHADO');
    assert.equal(result.hasBackorder, false);
    assert.equal(result.backorderItems.length, 0);
    assert.equal(result.updatedState[0].shippedQty, 10);
  });

  test('7. Intento de sobre-despacho arroja excepción estricta QUANTITY_EXCEEDED', () => {
    const initialItems: ItemState[] = [
      { orderItemId: 'item-1', orderedQty: 5, shippedQty: 3 },
    ];

    assert.throws(
      () => simulateDispatch(initialItems, [{ orderItemId: 'item-1', dispatchQty: 3 }]),
      /QUANTITY_EXCEEDED/
    );
  });

  test('8. Despacho de ítem inexistente arroja error ITEM_NOT_FOUND', () => {
    const initialItems: ItemState[] = [
      { orderItemId: 'item-1', orderedQty: 5, shippedQty: 0 },
    ];

    assert.throws(
      () => simulateDispatch(initialItems, [{ orderItemId: 'item-inexistente', dispatchQty: 1 }]),
      /ITEM_NOT_FOUND/
    );
  });

  // ─── 3. Trazabilidad de Guías de Transportadoras ───
  test('9. Construcción correcta de URLs de transportadoras homologadas', () => {
    const coordUrl = buildTrackingUrl('COORDINADORA', '77889900');
    assert.equal(coordUrl, 'https://www.coordinadora.com/portafolio-de-servicios/rastreo-de-guias/?guia=77889900');

    const serviUrl = buildTrackingUrl('SERVIENTREGA', '99112233');
    assert.equal(serviUrl, 'https://www.servientrega.com/wps/portal/rastreo-envio?id=99112233');

    const enviaUrl = buildTrackingUrl('ENVIA', '01020304');
    assert.equal(enviaUrl, 'https://sientrada.envia.co/seguimiento/01020304');
  });

  test('10. Manejo de transportadora no homologada o guía vacía devuelve null seguro', () => {
    assert.equal(buildTrackingUrl('TRANSPORTADORA_DESCONOCIDA', '12345'), null);
    assert.equal(buildTrackingUrl('COORDINADORA', ''), null);
    assert.equal(buildTrackingUrl('SERVIENTREGA', undefined), null);
  });
});
