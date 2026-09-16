// Only exact item identities can supply a detail image. Shared-model ancestry
// and NGC photon variants do not establish a specific equipment identity.
export function selectHdImages(gallery) {
  const images = new Map();
  for (const asset of gallery.assets) {
    if (!['item', 'shared-appearance'].includes(asset.kind)) continue;
    for (const id of asset.itemIds) {
      const previous = images.get(id);
      const canonical = `items/${id}.webp`;
      if (previous && previous !== canonical && asset.file !== canonical) {
        throw new Error(`Multiple HD images without a primary image: ${id}`);
      }
      if (!previous || asset.file === canonical) images.set(id, asset.file);
    }
  }
  return images;
}
