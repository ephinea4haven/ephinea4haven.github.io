import '@angular/compiler';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicUrlSerializer } from '../src/app/shared/public-url-serializer.ts';

test('directory URLs round-trip without empty language route segments', () => {
  const serializer = new PublicUrlSerializer();
  for (const language of ['en', 'ja']) {
    const tree = serializer.parse(`/${language}/?tag=a&tag=b#section`);
    assert.deepEqual(tree.root.children.primary.segments.map(segment => segment.path), [language]);
    assert.deepEqual(tree.queryParams.tag, ['a', 'b']);
    assert.equal(serializer.serialize(tree), `/${language}/?tag=a&tag=b#section`);
  }
  for (const url of ['/', '/items/excalibur/', '/404.html', '/en/items/index.html?x=1#details']) {
    assert.equal(serializer.serialize(serializer.parse(url)), url);
  }
  assert.equal(serializer.serialize(serializer.parse('/items?type=sword#results')), '/items/?type=sword#results');
});
