// backend/src/lib/telecomBomEngine.ts
/**
 * Motor de Manufactura, Ensambles Electrónicos y Listas de Materiales (BOM)
 * Inspirado en Odoo mrp (Phantom BOM, Scrap de corte de cable, Cost Rollup con mano de obra)
 * Optimizado para telecomunicaciones en MARAL OS
 */

export interface BomComponentDefinition {
  componentId: string;
  reference: string;
  name: string;
  unit: string;
  qty: number;
  cost: number;
  scrapPercentage?: number; // Ej: 0.06 para 6% de merma en corte de coaxial
  isPhantomKit?: boolean;
  subComponents?: BomComponentDefinition[];
}

export interface ExplodedMaterial {
  componentId: string;
  reference: string;
  name: string;
  unit: string;
  baseQtyPerUnit: number;
  scrapPercentage: number;
  grossQtyPerUnit: number;
  totalRequiredQty: number;
  unitCost: number;
  totalCost: number;
  path: string[];
}

export interface CostRollupResult {
  productId: string;
  reference: string;
  directMaterialCost: number;
  scrapMaterialCost: number;
  totalMaterialCost: number;
  laborMinutes: number;
  laborCost: number;
  totalRollupCost: number;
  currentCost: number;
  variance: number;
  materials: ExplodedMaterial[];
}

const roundQty = (val: number, decimals: number = 4): number => {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
};

const roundCurrency = (val: number): number => {
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

export class TelecomBomEngine {
  /**
   * Explosión recursiva de BOM con soporte para merma técnica (scrap) y detección de bucles
   */
  public static explodeKit(
    kitDefinition: BomComponentDefinition,
    orderQty: number = 1,
    overrides?: Map<string, number>,
    visited: Set<string> = new Set(),
    currentPath: string[] = []
  ): ExplodedMaterial[] {
    const productId = kitDefinition.componentId;
    if (visited.has(productId)) {
      throw new Error(`CIRCULAR_BOM_DEPENDENCY_DETECTED: ${[...currentPath, kitDefinition.reference].join(' -> ')}`);
    }

    const nextVisited = new Set(visited);
    nextVisited.add(productId);
    const path = [...currentPath, kitDefinition.reference];

    if (!kitDefinition.subComponents || kitDefinition.subComponents.length === 0) {
      return [];
    }

    const result: ExplodedMaterial[] = [];

    for (const comp of kitDefinition.subComponents) {
      let baseQty = comp.qty;
      if (overrides && overrides.has(comp.componentId)) {
        baseQty = overrides.get(comp.componentId)!;
      }

      const scrapRate = comp.scrapPercentage || 0;
      const grossQtyPerUnit = roundQty(baseQty * (1 + scrapRate));
      const totalGrossQty = roundQty(orderQty * grossQtyPerUnit);

      // Si el componente es a su vez un sub-kit virtual (Phantom)
      if (comp.isPhantomKit && comp.subComponents && comp.subComponents.length > 0) {
        const subMaterials = this.explodeKit(comp, totalGrossQty, overrides, nextVisited, path);
        if (subMaterials.length > 0) {
          result.push(...subMaterials);
          continue;
        }
      }

      result.push({
        componentId: comp.componentId,
        reference: comp.reference,
        name: comp.name,
        unit: comp.unit || 'und',
        baseQtyPerUnit: baseQty,
        scrapPercentage: scrapRate,
        grossQtyPerUnit,
        totalRequiredQty: totalGrossQty,
        unitCost: comp.cost,
        totalCost: roundCurrency(totalGrossQty * comp.cost),
        path,
      });
    }

    return result;
  }

  /**
   * Rollup de Costos Industriales: Materiales + Merma técnica + Mano de obra por minutos
   */
  public static calculateCostRollup(
    kitDefinition: BomComponentDefinition,
    laborMinutes: number = 0,
    hourlyLaborRate: number = 30000,
    currentCost: number = 0
  ): CostRollupResult {
    const materials = this.explodeKit(kitDefinition, 1);

    let directCost = 0;
    let scrapCost = 0;

    for (const mat of materials) {
      const net = mat.baseQtyPerUnit * mat.unitCost;
      const scrap = (mat.grossQtyPerUnit - mat.baseQtyPerUnit) * mat.unitCost;
      directCost += net;
      scrapCost += scrap;
    }

    const totalMatCost = roundCurrency(directCost + scrapCost);
    const laborCost = roundCurrency((laborMinutes / 60) * hourlyLaborRate);
    const totalRollupCost = roundCurrency(totalMatCost + laborCost);

    return {
      productId: kitDefinition.componentId,
      reference: kitDefinition.reference,
      directMaterialCost: roundCurrency(directCost),
      scrapMaterialCost: roundCurrency(scrapCost),
      totalMaterialCost: totalMatCost,
      laborMinutes,
      laborCost,
      totalRollupCost,
      currentCost,
      variance: roundCurrency(totalRollupCost - currentCost),
      materials,
    };
  }

  /**
   * Simulación de despacho de Kit Virtual (Phantom BOM): consume materias primas sin tocar el stock del kit padre
   */
  public static simulatePhantomDispatch(
    stockInventory: Map<string, number>,
    kitDefinition: BomComponentDefinition,
    kitQty: number,
    overrides?: Map<string, number>
  ): {
    updatedInventory: Map<string, number>;
    consumedMaterials: ExplodedMaterial[];
  } {
    const materials = this.explodeKit(kitDefinition, kitQty, overrides);
    const updated = new Map(stockInventory);

    // 1. Validar existencias
    for (const mat of materials) {
      const currentStock = updated.get(mat.componentId) || 0;
      if (currentStock < mat.totalRequiredQty) {
        throw new Error(`INSUFFICIENT_STOCK: ${mat.reference} (Disponible: ${currentStock}, Requerido: ${mat.totalRequiredQty})`);
      }
    }

    // 2. Descontar materias primas
    for (const mat of materials) {
      const currentStock = updated.get(mat.componentId) || 0;
      updated.set(mat.componentId, roundQty(currentStock - mat.totalRequiredQty));
    }

    return { updatedInventory: updated, consumedMaterials: materials };
  }

  /**
   * Simulación de completado de Orden de Fabricación (MO): consume insumos e incrementa producto terminado
   */
  public static simulateProductionOrderCompletion(
    stockInventory: Map<string, number>,
    kitDefinition: BomComponentDefinition,
    productionQty: number
  ): {
    updatedInventory: Map<string, number>;
    finishedProductId: string;
    finishedProductQty: number;
  } {
    const materials = this.explodeKit(kitDefinition, productionQty);
    const updated = new Map(stockInventory);

    // Validar existencias de insumos
    for (const mat of materials) {
      const currentStock = updated.get(mat.componentId) || 0;
      if (currentStock < mat.totalRequiredQty) {
        throw new Error(`INSUFFICIENT_RAW_MATERIAL: ${mat.reference}`);
      }
    }

    // Consumir insumos
    for (const mat of materials) {
      const currentStock = updated.get(mat.componentId) || 0;
      updated.set(mat.componentId, roundQty(currentStock - mat.totalRequiredQty));
    }

    // Incrementar producto terminado
    const currentFinished = updated.get(kitDefinition.componentId) || 0;
    updated.set(kitDefinition.componentId, currentFinished + productionQty);

    return {
      updatedInventory: updated,
      finishedProductId: kitDefinition.componentId,
      finishedProductQty: productionQty,
    };
  }
}
