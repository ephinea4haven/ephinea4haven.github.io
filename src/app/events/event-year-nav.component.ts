import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SiteLanguage } from '../shared/site-language.service';

@Component({
  selector: 'event-year-nav',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: contents; }',
  template: `@for (year of years(); track year) {
    @if (year === selected()) { <span class="year-current" aria-current="page">{{ year }}</span> }
    @else { <a [routerLink]="site.link('/events/' + event() + '/')" [queryParams]="{year}">{{ year }}</a> }
  }`,
})
export class EventYearNavComponent {
  readonly years = input.required<readonly number[]>();
  readonly event = input.required<string>();
  protected readonly site = inject(SiteLanguage);
  private readonly route = inject(ActivatedRoute);
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly selected = computed(() => {
    const year = Number(this.query().get('year'));
    return this.years().includes(year) ? year : this.years()[0];
  });
}
