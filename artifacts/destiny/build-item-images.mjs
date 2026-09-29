import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const imageDirectory = join(directory, 'dropcharts', 'destiny', 'images');
const referenceDirectory = join(directory, '..', '..', '..', 'bb-psov4', 'ref', 'custom_item_assets', 'reference');
const stockArchivePath = join(directory, '..', '..', '..', 'ItemPMT', 'artifacts', 'itemkt-exports', 'v4', 'ItemKTep4.afs');
const destinyArchivePath = join(directory, 'resources', 'originals', 'ItemKTep4.afs');
const noDataHash = 'e015d11321193c7f4db1f01342ac49a066ac5ba9ea80569d12f481fd4d75c2f8';
const acceptedStatuses = new Set(['parameter_consistent', 'name_only']);
const previewDirectory = join(directory, 'resources', 'model-previews');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function afsEntry(archive, index) {
  assert(archive.toString('ascii', 0, 3) === 'AFS', 'Invalid AFS magic');
  const count = archive.readUInt32LE(4);
  assert(index >= 0 && index < count, `AFS entry ${index} outside ${count} entries`);
  const offset = archive.readUInt32LE(8 + 8 * index);
  const size = archive.readUInt32LE(12 + 8 * index);
  assert(offset > 0 && size > 0 && offset + size <= archive.length, `Invalid AFS entry ${index}`);
  return archive.subarray(offset, offset + size);
}

function readTsv(text) {
  const [header, ...lines] = text.trimEnd().split('\n');
  const fields = header.split('\t');
  const records = new Map();
  for (const line of lines) {
    const values = line.split('\t');
    assert(values.length === fields.length, 'Malformed vanilla item asset reference TSV');
    const row = Object.fromEntries(values.map((value, index) => [fields[index], value]));
    assert(!records.has(row.item_code), `Duplicate vanilla item code ${row.item_code}`);
    records.set(row.item_code, row);
  }
  return records;
}

function verifiedAsset(assets, kind, slot, path) {
  const key = `${kind}_${String(slot).padStart(3, '0')}`;
  const asset = assets[key];
  assert(asset?.decoded?.path === path, `Model preview ${key} lacks matching extracted asset evidence`);
  return asset;
}

async function addModelPreviews(mapping, catalog, byCode) {
  const jobsManifest = await json(join(previewDirectory, 'jobs.json'));
  const assetsManifest = await json(join(previewDirectory, 'assets-manifest.json'));
  const candidates = await json(join(previewDirectory, 'name-candidates.json'));
  const renderScriptSha256 = sha256(await readFile(join(previewDirectory, 'render_textured.py')));
  const renderAdapterSha256 = sha256(await readFile(join(previewDirectory, 'model_adapters.py')));
  const renderRunnerSha256 = sha256(await readFile(join(previewDirectory, 'render_jobs.py')));
  assert(jobsManifest.schema === 'destiny-model-preview-jobs-v1', 'Unexpected model preview jobs schema');
  assert(assetsManifest.schema === 'destiny-model-preview-assets-v1', 'Unexpected model preview assets schema');
  const modelArchiveSha256 = sha256(await readFile(join(directory, 'resources', 'originals', 'ItemModelEp4.afs')));
  const textureArchiveSha256 = sha256(await readFile(join(directory, 'resources', 'originals', 'ItemTextureEp4.afs')));
  const dropByName = new Map(catalog.dropItems.map((item) => [item.name, item]));
  const candidatePairs = new Set(candidates.matches.filter((candidate) =>
    candidate.status === 'website_parameter_correlated_candidate').map((candidate) => `${candidate.name}\0${candidate.code}`));
  const previews = [];
  let pendingVisualQa = 0;
  let rejectedVisualQa = 0;
  for (const job of jobsManifest.jobs) {
    assert(job.resource_verified === true, `${job.item}: model/texture source not verified`);
    assert(Array.isArray(job.drop_names) && job.drop_names.length > 0, `${job.item}: no drop names`);
    const pmt = byCode.get(job.code);
    assert(pmt && pmt.family === job.family && pmt.pmt_id === job.pmt_id,
      `${job.item}: PMT code/family/ID mismatch`);
    assert(pmt.family === 'weapon' || pmt.family === 'shield', `${job.item}: unsupported model preview family`);
    const modelSlot = pmt.type + (pmt.family === 'shield' ? 354 : 0);
    const textureSlot = pmt.skin + (pmt.family === 'shield' ? 378 : 0);
    assert(job.model_slot === modelSlot && job.texture_slot === textureSlot,
      `${job.item}: model/texture selector mismatch`);
    const model = verifiedAsset(assetsManifest.assets, 'model', modelSlot, job.model);
    const texture = verifiedAsset(assetsManifest.assets, 'texture', textureSlot, job.texture);
    assert(model.archive_sha256 === modelArchiveSha256 && texture.archive_sha256 === textureArchiveSha256,
      `${job.item}: source archive hash mismatch`);
    assert(sha256(await readFile(join(previewDirectory, job.model))) === model.decoded.sha256,
      `${job.item}: model payload hash mismatch`);
    assert(sha256(await readFile(join(previewDirectory, job.texture))) === texture.decoded.sha256,
      `${job.item}: texture payload hash mismatch`);
    for (const name of job.drop_names) {
      const dropped = dropByName.get(name);
      assert(dropped && name === job.item, `${job.item}: output name is not an exact drop name`);
      if (job.source_status === 'source_matched') {
        assert(dropped.association.status === 'parameter_consistent' && dropped.association.code === job.code,
          `${job.item}: source-matched job lacks trusted catalog association`);
      } else if (job.source_status === 'website_parameter_correlated_candidate') {
        assert(candidatePairs.has(`${name}\0${job.code}`),
          `${job.item}: website parameter correlation is not documented`);
      } else {
        throw new Error(`${job.item}: unsupported source status ${job.source_status}`);
      }
    }
    assert(['pending', 'passed', 'rejected'].includes(job.visual_qa), `${job.item}: invalid visual QA status`);
    if (job.visual_qa !== 'passed') {
      if (job.visual_qa === 'pending') pendingVisualQa++;
      else rejectedVisualQa++;
      continue;
    }
    const output = resolve(previewDirectory, job.output);
    assert(dirname(output) === resolve(imageDirectory) && output.endsWith('.png'),
      `${job.item}: preview output is outside Destiny image directory`);
    const bytes = await readFile(output);
    assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && bytes[25] === 6,
      `${job.item}: preview is not an RGBA PNG`);
    const filename = basename(output);
    for (const name of job.drop_names) {
      assert(mapping[name] === undefined, `${name}: preview would overwrite an ItemKT image`);
      mapping[name] = filename;
    }
    previews.push({
      name: job.item,
      dropNames: job.drop_names,
      code: job.code,
      family: job.family,
      pmtId: job.pmt_id,
      image: filename,
      imageSha256: sha256(bytes),
      modelSlot,
      textureSlot,
      modelArchive: model.archive,
      modelArchiveSha256: model.archive_sha256,
      modelEntrySha256: model.prs.sha256,
      modelDecodedSha256: model.decoded.sha256,
      textureArchive: texture.archive,
      textureArchiveSha256: texture.archive_sha256,
      textureEntrySha256: texture.prs.sha256,
      textureDecodedSha256: texture.decoded.sha256,
      sourceStatus: job.source_status,
      resourceVerified: true,
      visualQa: 'passed',
      runtimeVerified: false,
      renderScriptSha256,
      renderAdapterSha256,
      renderRunnerSha256,
    });
  }
  return { previews, pendingVisualQa, rejectedVisualQa, jobs: jobsManifest.jobs.length,
    renderScriptSha256, renderAdapterSha256, renderRunnerSha256 };
}

async function main() {
  const catalog = await json(join(directory, 'catalog.json'));
  const pmt = await json(join(directory, 'pmt', 'records.json'));
  const imageManifest = await json(join(directory, 'resources', 'itemkt-images', 'manifest.json'));
  const vanilla = readTsv(await readFile(join(referenceDirectory, 'vanilla-item-model-texture.tsv'), 'utf8'));
  const destinyArchive = await readFile(destinyArchivePath);
  const stockArchive = await readFile(stockArchivePath);
  const ep4 = imageManifest.archives.ItemKTep4;
  assert(sha256(destinyArchive) === ep4.sha256, 'Destiny ItemKTep4 archive hash differs from image manifest');
  assert(destinyArchive.readUInt32LE(4) === 505 && stockArchive.readUInt32LE(4) === 505,
    'Expected BB ItemKTep4 archives with 505 entries');
  assert(ep4.entries[177].images[0].sha256 === noDataHash, 'NO DATA exemplar image changed');
  const byCode = new Map(pmt.records.map((item) => [item.code, item]));
  const mapping = {};
  const entries = [];
  const excluded = [];
  await mkdir(imageDirectory, { recursive: true });

  for (const item of catalog.dropItems) {
    if (!acceptedStatuses.has(item.association.status)) continue;
    const code = item.association.code;
    const record = byCode.get(code);
    assert(record, `${item.name}: PMT code ${code} missing`);
    const evidence = {
      name: item.name,
      code,
      family: record.family,
      pmtId: record.pmt_id,
      associationStatus: item.association.status,
    };
    if (record.family !== 'weapon') {
      excluded.push({ ...evidence, reason: 'no_itemkt_client_branch' });
      continue;
    }
    const reference = vanilla.get(code);
    assert(reference && Number(reference.item_id) === record.pmt_id,
      `${item.name}: weapon code/ID does not match vanilla BB reference`);
    const normal = (value) => value === -1 ? 0xffff : value;
    assert(normal(Number(reference.pmt_type)) === record.type && normal(Number(reference.pmt_skin)) === record.skin,
      `${item.name}: model/skin selector differs from vanilla BB reference`);
    if (record.pmt_id < 177 || record.pmt_id > 598) {
      excluded.push({ ...evidence, reason: 'client_generic_entry_504' });
      continue;
    }
    const entry = record.pmt_id - 95;
    const destinyBytes = afsEntry(destinyArchive, entry);
    assert(destinyBytes.equals(afsEntry(stockArchive, entry)),
      `${item.name}: Destiny ItemKT entry ${entry} differs from vanilla BB archive`);
    const image = ep4.entries[entry]?.images?.[0];
    if (!image) {
      excluded.push({ ...evidence, entry, reason: 'image_not_decoded' });
      continue;
    }
    if (image.sha256 === noDataHash) {
      excluded.push({ ...evidence, entry, reason: 'no_data_image' });
      continue;
    }
    const sourcePath = join(directory, 'resources', 'itemkt-images', image.path);
    const imageBytes = await readFile(sourcePath);
    assert(sha256(imageBytes) === image.sha256, `${item.name}: decoded PNG hash mismatch`);
    const filename = `${code}_${String(entry).padStart(4, '0')}.png`;
    assert(mapping[item.name] === undefined, `Duplicate exact drop name ${item.name}`);
    await copyFile(sourcePath, join(imageDirectory, filename));
    mapping[item.name] = filename;
    entries.push({
      ...evidence,
      archive: 'ItemKTep4.afs',
      archiveSha256: ep4.sha256,
      entry,
      entrySha256: sha256(destinyBytes),
      image: filename,
      imageSha256: image.sha256,
      sourceImage: relative(directory, sourcePath),
      evidence: 'Vanilla BB client PMT-ID rule; exact code, ID, type, and skin match vanilla reference; Destiny archive entry bytes equal vanilla archive entry bytes.',
    });
  }
  const { previews, pendingVisualQa, rejectedVisualQa, jobs, renderScriptSha256, renderAdapterSha256, renderRunnerSha256 } =
    await addModelPreviews(mapping, catalog, byCode);
  const manifest = {
    schema: 'destiny-drop-itemkt-images-v1',
    clientRule: 'For weapon PMT IDs 177..598, the BB client loads ItemKTep4.afs[PMT ID - 95]. Other weapons use generic entry 504; MAGs use their second code byte when <82; armor, shields, units, and tools have no branch in this lookup.',
    sources: {
      catalog: 'catalog.json',
      pmt: 'pmt/records.json',
      archive: relative(directory, destinyArchivePath),
      decodedImageManifest: 'resources/itemkt-images/manifest.json',
      vanillaReference: relative(directory, join(referenceDirectory, 'vanilla-item-model-texture.tsv')),
      modelPreviewJobs: 'resources/model-previews/jobs.json',
      modelPreviewAssets: 'resources/model-previews/assets-manifest.json',
      websiteParameterCandidates: 'resources/model-previews/name-candidates.json',
      renderScriptSha256,
      renderAdapterSha256,
      renderRunnerSha256,
    },
    noDataImageSha256: noDataHash,
    counts: {
      trustedPairs: catalog.dropItems.filter((item) => acceptedStatuses.has(item.association.status)).length,
      mapped: Object.keys(mapping).length,
      mappedItemKt: entries.length,
      mappedModelPreview: previews.length,
      modelPreviewJobs: jobs,
      modelPreviewPendingVisualQa: pendingVisualQa,
      modelPreviewRejectedVisualQa: rejectedVisualQa,
      excludedByReason: Object.fromEntries([...new Set(excluded.map((item) => item.reason))].sort().map(
        (reason) => [reason, excluded.filter((item) => item.reason === reason).length],
      )),
    },
    entries,
    excluded,
    modelPreviews: previews,
  };
  assert(Object.keys(mapping).length === entries.length + previews.reduce((sum, preview) => sum + preview.dropNames.length, 0),
    'Mapping and image evidence counts differ');
  assert(manifest.counts.trustedPairs === entries.length + excluded.length,
    'Trusted catalog pairs are not fully classified');
  await writeFile(join(imageDirectory, 'mapping.json'), `${JSON.stringify(mapping, null, 2)}\n`);
  await writeFile(join(imageDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest.counts));
}

await main();
