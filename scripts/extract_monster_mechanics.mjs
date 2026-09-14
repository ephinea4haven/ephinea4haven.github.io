// Runs against a DOMParser document of MediaWiki action=parse output.
// Keep table facts, contextual tabs, cell notes and spans; do not copy article prose.
export function extractMechanicTables(document) {
  const result = [];
  let major = '', section = '', anchor = '';
  const headings = [];
  const clean = text => text.replace(/\s+/g, ' ').trim();
  for (const node of document.querySelectorAll('h2,h3,h4,h5,h6,table.wikitable')) {
    if (/^H[23456]$/.test(node.tagName)) {
      if (!node.parentElement.classList.contains('mw-parser-output')) continue;
      const heading = node.querySelector('.mw-headline');
      section = clean(heading?.textContent || node.textContent);
      anchor = heading?.id || '';
      headings.length = Number(node.tagName[1]) - 2;
      headings.push(section);
      if (node.tagName === 'H2') major = section;
      continue;
    }
    if (!/behavior|mechanics|strategy/i.test(major)) continue;
    if (!/damage|megid|targeting|resistan|immun|attack|mechanics|behavior/i.test(section) && !headings.includes('Attacks')) continue;
    if (/breakpoints/i.test(section)) continue;
    if (node.querySelector('table') || /Monsters that ignore technique boosts/.test(node.caption?.textContent || '')) continue;
    const context = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (parent.classList.contains('tabbertab')) context.unshift(parent.getAttribute('title'));
    }
    const grid = [];
    const rows = [...node.rows];
    rows.forEach((row, y) => {
      grid[y] ||= [];
      let x = 0;
      for (const cell of row.cells) {
        while (grid[y][x] !== undefined) x++;
        const copy = cell.cloneNode(true);
        for (const br of copy.querySelectorAll('br')) br.replaceWith(' / ');
        const notes = [...copy.querySelectorAll('[title]')].map(n => clean(n.getAttribute('title'))).filter(Boolean);
        const value = clean(copy.textContent);
        const text = value + (notes.length ? ` (${[...new Set(notes)].filter(n => n !== value).join('; ')})` : '');
        for (let dy = 0; dy < cell.rowSpan; dy++) {
          grid[y + dy] ||= [];
          for (let dx = 0; dx < cell.colSpan; dx++) grid[y + dy][x + dx] = text.replace(/ \(\)$/, '');
        }
        x += cell.colSpan;
      }
    });
    if (grid.length > 1) result.push({section, anchor, caption:clean(node.caption?.textContent || ''), context, rows:grid});
  }
  return result;
}
