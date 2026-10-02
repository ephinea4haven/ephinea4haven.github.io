import { afterNextRender, ChangeDetectorRef, DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';

export type ToolQuery = Record<string, string | number | null | readonly string[]>;

function queryValues(query: ToolQuery): Record<string, string | string[]> {
  // NumberValueAccessor uses null for a cleared input. Both calculators compute
  // that as zero; serialize zero without replacing the blank field during typing.
  return Object.fromEntries(Object.entries(query).map(([key, value]) =>
    [key, Array.isArray(value) ? value.map(String) : String(value ?? 0)]));
}

function signature(params: ParamMap): string {
  return JSON.stringify([...params.keys].filter((key) => params.getAll(key).length)
    .sort().map((key) => [key, params.getAll(key).map(String)]));
}

/** Each tool owns its URL. Edits replace the current entry; external navigation restores it. */
@Injectable()
export class ToolUrlState {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private ready = false;
  private currentSignature = '';

  connect(restore: (params: ParamMap) => void): void {
    // Static prerendered pages contain the defaults. Restore after hydration.
    afterNextRender(() => {
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const next = signature(params);
        if (this.ready && next === this.currentSignature) return;
        this.currentSignature = next;
        restore(params);
        this.ready = true;
        this.changeDetector.markForCheck();
      });
    });
  }

  write(query: ToolQuery): void {
    if (!this.ready) return;
    const values = queryValues(query);
    const next = signature(convertToParamMap(values));
    if (next === this.currentSignature) return;
    this.currentSignature = next;
    const url = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: values,
      preserveFragment: true,
    });
    void this.router.navigateByUrl(url, { replaceUrl: true });
  }
}

export function toolChoice<T extends string>(params: ParamMap, key: string, choices: readonly T[], defaultValue: T): T {
  const value = params.get(key);
  return value !== null && choices.includes(value as T) ? value as T : defaultValue;
}

export function toolNumber(params: ParamMap, key: string, defaultValue: number, min = 0, max = 999, integer = true): number {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return defaultValue;
  const value = Number(raw);
  return Number.isFinite(value) && (!integer || Number.isInteger(value)) && value >= min && value <= max
    ? value : defaultValue;
}

export function toolQueryString(query: ToolQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryValues(query))) {
    for (const entry of Array.isArray(value) ? value : [value]) params.append(key, String(entry));
  }
  return params.toString();
}
