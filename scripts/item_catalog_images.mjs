// Rarity is the Ephinea Wiki's displayed star count, not the equip level.
export function equipmentImage({ category, code, rarity, wikiImage }, manifest) {
  if (category === 'tool') {
    const box = manifest.toolBoxes[code];
    return box ? manifest.boxes[box.color] : null;
  }
  if (!['armor', 'shield', 'unit'].includes(category)) return null;
  if (category !== 'unit') {
    const preview = manifest.entries[code];
    if (preview?.kind === 'effect' || preview?.kind === 'illustration') return preview;
    if (wikiImage) return { ...wikiImage, kind: 'screenshot', origin: 'wiki',
      ...(preview?.origin === 'gallery' ? { thumbnail: preview.thumbnail } : {}) };
    if (preview) return preview;
  }
  if (!Number.isInteger(rarity)) throw new Error(`Missing equipment rarity: ${code}`);
  return manifest.boxes[rarity >= 9 ? 'red' : 'blue'];
}
