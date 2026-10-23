import { DefaultUrlSerializer, UrlTree } from '@angular/router';

/** Keep Angular navigation consistent with Pages' directory-index URLs. */
export class PublicUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    const [, pathname, suffix] = /^([^?#]*)(.*)$/.exec(url)!;
    return super.parse(`${pathname.replace(/\/+$/, '') || '/'}${suffix}`);
  }

  override serialize(tree: UrlTree): string {
    const url = super.serialize(tree);
    const [, pathname, suffix] = /^([^?#]*)(.*)$/.exec(url)!;
    return pathname.endsWith('/') || /\.[a-z0-9]+$/i.test(pathname) ? url : `${pathname}/${suffix}`;
  }
}
