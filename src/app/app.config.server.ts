import { EP3_CARD_LOADER } from './ep3-card-catalog/ep3-card-data.service';
import ep3Details from './generated/ep3-card-catalog/details.server.json';
import type { CardDetail } from './ep3-card-catalog/card';
import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { ITEM_DETAIL_LOADER } from './item-catalog/item-data.service';
import { IndexRow, ITEM_INDEX_LOADER } from './item-catalog/catalog-index';
import itemIndex from './generated/item-catalog/index.json';
import { CHARACTER_DATA_LOADER } from './status/character-data';
import type { CharacterData } from './status/status-domain';
import characterData from '../../assets/js/chardata.json';
import details from './generated/item-catalog/details.server.json';
import type { ItemDetail } from './item-catalog/catalog';
import { MONSTER_LOADER } from './monster-catalog/monster-data.service';
import monsterDetails from './generated/monster-catalog/details.server.json';
import type { MonsterDetail } from './monster-catalog/monster';

export const serverConfig = mergeApplicationConfig(appConfig, {
  providers: [provideServerRendering(withRoutes(serverRoutes)), {provide:EP3_CARD_LOADER,useValue:async(id:string)=>(ep3Details as unknown as Record<string,CardDetail>)[id]}, {
    provide: ITEM_DETAIL_LOADER,
    useValue: async (id: string) => (details as Record<string, ItemDetail>)[id] ?? null,
  }, {
    provide: ITEM_INDEX_LOADER,
    useValue: async () => itemIndex as IndexRow[],
  }, {
    provide: CHARACTER_DATA_LOADER,
    useValue: async () => characterData as unknown as CharacterData,
  }, {provide:MONSTER_LOADER,useValue:async(id:string)=>(monsterDetails as Record<string,MonsterDetail>)[id]}],
});
