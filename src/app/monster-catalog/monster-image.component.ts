import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
@Component({
  selector:'monster-image',changeDetection:ChangeDetectionStrategy.OnPush,
  template:`@if (src() && failed() !== src()) {<img [src]="src()" [alt]="name()" loading="lazy" (error)="failed.set(src())" width="200" height="160">} @else {<span>{{ unavailable() }}</span>}`,
  styles:`:host {display:grid;place-items:center;position:relative;overflow:hidden;min-width:0;min-height:0;aspect-ratio:5/4;background:radial-gradient(ellipse at center,#244a554f,transparent 70%);border-radius:8px;}img {position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;}span {font-size:12px;color:#a8becd;padding:8px;text-align:center;}`,
})
export class MonsterImageComponent {
  readonly src=input<string|null>(null);readonly name=input('');readonly unavailable=input('');readonly failed=signal<string|null>(null);
}
