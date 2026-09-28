// Angular's critical-CSS optimizer (Beasties, preload: 'media-script') emits
// this invariant body to activate deferred stylesheets. Match it exactly so
// arbitrary page scripts remain rejected by validation and inline budgets.
const deferredStylesheetScript = "document.querySelectorAll('link[data-beasties-media]').forEach(function(l){l.media=l.getAttribute('data-beasties-media');l.removeAttribute('data-beasties-media')})";

export function isAngularInlineScript(node, attributes) {
  if (attributes.has('src')) return false;
  const id = attributes.get('id');
  const type = attributes.get('type');
  const source = node.childNodes?.map((child) => child.value || '').join('').trim() || '';
  return (id === 'ng-state' && type === 'application/json')
    || (id === 'ng-event-dispatch-contract' && type === 'text/javascript')
    || (!id && /^window\.__jsaction_bootstrap\(document\.body,"ng",\[.*\],\[.*\]\);$/.test(source))
    || (!id && !type && source === deferredStylesheetScript);
}
