// backend/src/tests/telecom_bom_engine.test.ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TelecomBomEngine,
  type BomComponentDefinition,
} from '../lib/telecomBomEngine.ts';

describe('Telecom BOM & Manufacturing Engine Suite (Odoo mrp REA)', () => {
  const vhfAntennaKit: BomComponentDefinition = {
    componentId: 'kit-ant-vhf',
    reference: 'ANT-VHF-KIT',
    name: 'Kit Antena Móvil VHF 5/8 con Base y Cable',
    unit: 'und',
    qty: 1,
    cost: 45000,
    isPhantomKit: true,
    subComponents: [
      { componentId: 'comp-base', reference: 'BM-NMO', name: 'Base Magnética NMO', unit: 'und', qty: 1, cost: 22000 },
      { componentId: 'comp-whip', reference: 'VAR-17-7', name: 'Varilla Acero 17-7 PH', unit: 'und', qty: 1, cost: 12000 },
      { componentId: 'comp-cable', reference: 'CB-RG58', name: 'Cable Coaxial RG-58 Mil-Spec', unit: 'm', qty: 4.5, cost: 2800, scrapPercentage: 0.06 },
      { componentId: 'comp-conn', reference: 'PL-259', name: 'Conector PL-259 Macho UHF', unit: 'und', qty: 1, cost: 3500 },
    ],
  };

  test('1. Explosión de kit estándar extrae todos los componentes requeridos', () => {
    const materials = TelecomBomEngine.explodeKit(vhfAntennaKit, 1);
    assert.equal(materials.length, 4);
    assert.equal(materials.find(m => m.reference === 'BM-NMO')?.totalRequiredQty, 1);
    assert.equal(materials.find(m => m.reference === 'PL-259')?.totalRequiredQty, 1);
  });

  test('2. Corte de cable coaxial a la medida aplica merma técnica de corte (scrap)', () => {
    // 4.5m con 6% de merma = 4.5 * 1.06 = 4.77m por unidad. Para 10 kits = 47.7m
    const materials = TelecomBomEngine.explodeKit(vhfAntennaKit, 10);
    const cable = materials.find(m => m.reference === 'CB-RG58');
    assert.ok(cable);
    assert.equal(cable.grossQtyPerUnit, 4.77);
    assert.equal(cable.totalRequiredQty, 47.7);
  });

  test('3. Explosión recursiva de BOM multinivel desenrolla sub-ensambles hasta materias primas', () => {
    const repeaterStation: BomComponentDefinition = {
      componentId: 'prod-repeater',
      reference: 'EST-BASE-RPT',
      name: 'Estación Base Repetidora Completa',
      unit: 'und',
      qty: 1,
      cost: 1500000,
      subComponents: [
        { componentId: 'comp-chassis', reference: 'CHS-19', name: 'Chasis Rack 19 Pulgadas', unit: 'und', qty: 1, cost: 180000 },
        {
          componentId: 'subkit-jumper',
          reference: 'JMP-LMR400-5M',
          name: 'Sub-ensamble Jumper LMR-400 5m',
          unit: 'und',
          qty: 2,
          cost: 65000,
          isPhantomKit: true,
          subComponents: [
            { componentId: 'comp-lmr400', reference: 'CB-LMR400', name: 'Cable LMR-400', unit: 'm', qty: 5, cost: 9500, scrapPercentage: 0.04 },
            { componentId: 'comp-n-male', reference: 'CONN-NM', name: 'Conector N Macho Clamp', unit: 'und', qty: 2, cost: 8500 },
          ],
        },
      ],
    };

    const materials = TelecomBomEngine.explodeKit(repeaterStation, 1);
    // Debe contener: chasis (1), cable LMR400 (2 * 5 * 1.04 = 10.4m), conectores N (2 * 2 = 4)
    assert.equal(materials.length, 3);
    const lmr = materials.find(m => m.reference === 'CB-LMR400');
    assert.ok(lmr);
    assert.equal(lmr.totalRequiredQty, 10.4);
    assert.equal(materials.find(m => m.reference === 'CONN-NM')?.totalRequiredQty, 4);
  });

  test('4. Detección de dependencias circulares evita bucles infinitos con error explícito', () => {
    const compA: BomComponentDefinition = {
      componentId: 'id-a',
      reference: 'REF-A',
      name: 'Componente A',
      unit: 'und',
      qty: 1,
      cost: 10,
      isPhantomKit: true,
      subComponents: [],
    };
    const compB: BomComponentDefinition = {
      componentId: 'id-b',
      reference: 'REF-B',
      name: 'Componente B',
      unit: 'und',
      qty: 1,
      cost: 10,
      isPhantomKit: true,
      subComponents: [compA],
    };
    compA.subComponents = [compB]; // Ciclo A -> B -> A

    assert.throws(
      () => TelecomBomEngine.explodeKit(compA, 1),
      /CIRCULAR_BOM_DEPENDENCY_DETECTED/
    );
  });

  test('5. Despacho de Kit Virtual (Phantom BOM) descuenta materias primas sin alterar kit padre', () => {
    const inventory = new Map<string, number>([
      ['comp-base', 10],
      ['comp-whip', 10],
      ['comp-cable', 100],
      ['comp-conn', 20],
      ['kit-ant-vhf', 0], // Stock del kit es 0
    ]);

    const res = TelecomBomEngine.simulatePhantomDispatch(inventory, vhfAntennaKit, 2);
    // Consumo para 2 kits: 2 bases, 2 varillas, 2*4.77 = 9.54m cable, 2 conectores
    assert.equal(res.updatedInventory.get('comp-base'), 8);
    assert.equal(res.updatedInventory.get('comp-whip'), 8);
    assert.equal(res.updatedInventory.get('comp-cable'), 90.46);
    assert.equal(res.updatedInventory.get('comp-conn'), 18);
    assert.equal(res.updatedInventory.get('kit-ant-vhf'), 0); // Permanece intacto
  });

  test('6. Completado de Orden de Fabricación (MO) consume insumos y da entrada a producto terminado', () => {
    const inventory = new Map<string, number>([
      ['comp-base', 10],
      ['comp-whip', 10],
      ['comp-cable', 50],
      ['comp-conn', 10],
      ['kit-ant-vhf', 0],
    ]);

    const res = TelecomBomEngine.simulateProductionOrderCompletion(inventory, vhfAntennaKit, 5);
    // Producto terminado incrementa en 5
    assert.equal(res.updatedInventory.get('kit-ant-vhf'), 5);
    // Bases consumidas: 5 (quedan 5)
    assert.equal(res.updatedInventory.get('comp-base'), 5);
    // Cable consumido: 5 * 4.77 = 23.85m (quedan 26.15m)
    assert.equal(res.updatedInventory.get('comp-cable'), 26.15);
  });

  test('7. Rollup de Costo Industrial con tiempo de ensamble calcula el verdadero costo unitario', () => {
    // 20 minutos de ensamble a $30,000/hr = (20/60) * 30000 = $10,000
    // Materiales netos: 22000 + 12000 + (4.5 * 2800 = 12600) + 3500 = $50,100
    // Merma de cable: 0.27m * 2800 = $756
    // Total material = $50,856
    // Total Rollup = 50856 + 10000 = $60,856
    const rollup = TelecomBomEngine.calculateCostRollup(vhfAntennaKit, 20, 30000, 45000);
    assert.equal(rollup.directMaterialCost, 50100);
    assert.equal(rollup.scrapMaterialCost, 756);
    assert.equal(rollup.totalMaterialCost, 50856);
    assert.equal(rollup.laborCost, 10000);
    assert.equal(rollup.totalRollupCost, 60856);
    assert.equal(rollup.variance, 15856); // $60,856 - $45,000 histórico
  });

  test('8. Personalización dinámica desde cotización ajusta consumo de componentes y metraje', () => {
    const customOverrides = new Map<string, number>([
      ['comp-cable', 10], // Cliente pidió 10 metros en vez de 4.5m
    ]);
    const materials = TelecomBomEngine.explodeKit(vhfAntennaKit, 1, customOverrides);
    const cable = materials.find(m => m.reference === 'CB-RG58');
    assert.ok(cable);
    // 10 * 1.06 = 10.6 metros
    assert.equal(cable.baseQtyPerUnit, 10);
    assert.equal(cable.grossQtyPerUnit, 10.6);
    assert.equal(cable.totalRequiredQty, 10.6);
  });

  test('9. Rotura de stock bloquea el ensamble protegiendo la integridad del inventario', () => {
    const inventory = new Map<string, number>([
      ['comp-base', 1], // Solo hay 1 base
      ['comp-whip', 10],
      ['comp-cable', 50],
      ['comp-conn', 10],
    ]);

    assert.throws(
      () => TelecomBomEngine.simulatePhantomDispatch(inventory, vhfAntennaKit, 2),
      /INSUFFICIENT_STOCK: BM-NMO/
    );
  });

  test('10. Conservación contable de inventario valida correspondencia estricta de débitos y créditos', () => {
    const inventory = new Map<string, number>([
      ['comp-base', 5],
      ['comp-whip', 5],
      ['comp-cable', 25],
      ['comp-conn', 5],
    ]);
    const res = TelecomBomEngine.simulateProductionOrderCompletion(inventory, vhfAntennaKit, 1);
    assert.equal(res.finishedProductQty, 1);
    assert.ok(res.updatedInventory.get('comp-base')! < 5);
  });
});
