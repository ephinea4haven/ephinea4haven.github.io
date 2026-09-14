// Parse only balanced MediaWiki template calls. Rendering is handled by MediaWiki.
export function splitArguments(source) {
  const values = [];
  let braces = 0;
  let links = 0;
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const pair = source.slice(i, i + 2);
    if (pair === '{{') { braces += 1; i += 1; }
    else if (pair === '}}') { braces -= 1; i += 1; }
    else if (pair === '[[') { links += 1; i += 1; }
    else if (pair === ']]') { links -= 1; i += 1; }
    else if (source[i] === '|' && braces === 0 && links === 0) {
      values.push(source.slice(start, i).trim());
      start = i + 1;
    }
  }
  values.push(source.slice(start).trim());
  return values;
}

export function templates(source) {
  source = source.replace(/<!--[\s\S]*?-->/g, '');
  const found = [];
  const stack = [];
  for (let i = 0; i < source.length - 1; i += 1) {
    const pair = source.slice(i, i + 2);
    if (pair === '{{') { stack.push(i); i += 1; }
    else if (pair === '}}' && stack.length) {
      const start = stack.pop();
      const [name, ...args] = splitArguments(source.slice(start + 2, i));
      const fields = {};
      let position = 1;
      for (const arg of args) {
        const named = /^([\w -]+)\s*=([\s\S]*)$/.exec(arg);
        if (named) fields[named[1].trim()] = named[2].trim();
        else fields[position++] = arg;
      }
      found.push({ name, fields, start, end: i + 2 });
      i += 1;
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

export function pageSource(page) {
  return page?.revisions?.[0]?.slots?.main?.content ?? '';
}
