import type { ItemCatalog } from './status-domain';

export class ItemData implements ItemCatalog {
  readonly armors: ItemCatalog['armors'];
  readonly shields: ItemCatalog['shields'];
  readonly units: ItemCatalog['units'];
}
