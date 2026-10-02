export interface SearchText { text: string; highlighted: boolean }

/** Parse in an inert template; only text and a mark flag can reach the rendered view. */
export function searchSnippet(html: string): SearchText[] {
  const template = document.createElement('template');
  template.innerHTML = html;
  const parts: SearchText[] = [];
  const read = (node: Node, highlighted = false): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) parts.push({ text: node.textContent, highlighted });
      return;
    }
    if (['SCRIPT', 'STYLE', 'TEMPLATE'].includes(node.nodeName)) return;
    for (const child of node.childNodes) read(child, highlighted || node.nodeName === 'MARK');
  };
  read(template.content);
  return parts;
}
