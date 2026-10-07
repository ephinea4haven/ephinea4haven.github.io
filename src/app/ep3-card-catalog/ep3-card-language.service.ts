import { Injectable } from '@angular/core';
import { LanguagePreferenceService } from '../shared/language-preference.service';
import { messages } from './ep3-card.messages';
@Injectable()
export class Ep3CardLanguageService extends LanguagePreferenceService {
  t(key:string):string {return messages[key]?.[this.language()==='zh'?0:this.language()==='en'?1:2] ?? key;}
  pageRange(first:number,last:number,total:number):string {
    return this.language() === 'zh' ? `第 ${first}–${last} 件，共 ${total} 件` : this.language() === 'ja' ? `${total} 件中 ${first}–${last} 件` : `${first}–${last} of ${total} items`;
  }
}
