import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const languages = ['zh', 'en', 'ja'];
const expectedEp1 = [
  1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
].map((area) => `area_${String(area).padStart(2, '0')}.png`);
const expectedEp2 = new Map([
  ['2ca1.png', [1, 1, '9cc81e71b7759962bcd25fff8c8d925c3357ff5d']],
  ['2ca2.png', [1, 2, '6542d1e78875c93027c1ee50ddb0c7312372072e']],
  ['2ca3.png', [1, 3, 'dadf8725984997fa762b2c2c36a327c08e62684b']],
  ['2ca4.png', [1, 4, 'a1555263f60a501c0c88994363236c7b6b804726']],
  ['2ca5.png', [1, 5, 'f0a8d12100341c43729baa683df1e4eb2a00d274']],
  ['2ca6.png', [1, 6, '05b6cb4982ebe5ad9ee1466ec0054887d541f294']],
  ['2ca8.png', [2, 8, 'daf4817aa916f8f2c57fe5feb12d2b94507d04f3']],
  ['2ca9.png', [2, 9, 'db9e35547b147cd260f7fe9dc04d32b259e9bf7c']],
  ['2ca10.png', [2, 10, 'fcb53fd1838777af1a078104de0fafd2a7556d59']],
  ['2ca11.png', [2, 11, 'fbdd6e3ce1a6891b2e22a0383c617f7d7395fcf8']],
  ['2ca12.png', [2, 12, '8913a536425b54b9ea89f601a27adef0da7d2922']],
  ['2ca13.png', [2, 13, 'db5a30791e3ec2c3f04a420d99c2e3598ed4af0d']],
  ['2ca15.png', [3, 15, '49d9cab661261139c429f4c1091d0480ba61f0df']],
  ['2ca16.png', [3, 16, '0a889e35789d1bd84d40e59466ec73052d4c4f82']],
  ['2ca17.png', [3, 17, '335c27da9a0efe13e0e220242acdf1c2b4bcdfa1']],
  ['2ca18.png', [3, 18, '81b93b5b8641eb247da347d44e7b48578ebf3c51']],
  ['2ca19.png', [3, 19, '67e192fed2be6c792525e7d87b79d6cacae22ad8']],
  ['2ca21.png', [4, 21, '061d843f9f7fd7e7d6e2c066b5291b51404b1634']],
  ['2ca22(drue).png', [4, 22, '500fb014ad221854b0dec71c358b53f602e07453']],
  ['2ca23.png', [4, 23, 'de2f220aee773eb99ffe159b16f71d16cf270467']],
  ['2ca24.png', [4, 24, 'a2274b9bd699dfb23ff4a030ad5195d9cb9de4df']],
  ['2ca25.png', [4, 25, 'b9a803d1dc23b2e024cd3613e7a23133da107134']],
  ['2ca26.png', [4, 26, 'e97e40ed82288d77df630e57df781bf98b2af569']],
  ['2ca28.png', [5, 28, '0630dbac3dbae45c48c3bc55156975f87ab1f22f']],
  ['2ca29.png', [5, 29, 'deba790beb36c3907c0baf9f5e8e321ae2dab1fc']],
]);

function pngDimensions(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function verifyInventory(directory, expected, pattern = /\.(png|jpe?g)$/i) {
  const actual = (await readdir(directory))
    .filter((name) => pattern.test(name))
    .sort((first, second) => first.localeCompare(second, 'en', { numeric: true }));
  const sortedExpected = [...expected].sort((first, second) => first.localeCompare(second, 'en', { numeric: true }));
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    throw new Error(`${directory} does not contain the exact expected inventory`);
  }
}

const ep1Directory = path.join(root, 'assets/img/challenge/ep1/original');
const ep2SourceDirectory = path.join(root, 'assets/img/challenge/ep2/original/wiki');
const ep2MapsDirectory = path.join(root, 'assets/img/challenge/ep2/maps');
await verifyInventory(ep1Directory, expectedEp1);
await verifyInventory(ep2SourceDirectory, expectedEp2.keys());

const ep1Page = await readFile(path.join(root, 'guide/ep1ch.html'), 'utf8');
const ep2Page = await readFile(path.join(root, 'guide/ep2ch.html'), 'utf8');

for (const name of expectedEp1) {
  const stem = name.replace('.png', '');
  const dimensions = pngDimensions(await readFile(path.join(ep1Directory, name)));
  if (dimensions.width < 220 || dimensions.height < 220 || dimensions.width * dimensions.height < 65000) {
    throw new Error(`EP1 source ${name} is below the resolution floor`);
  }
  for (const language of languages) {
    const relative = `/assets/img/challenge/ep1/maps/${language}/${stem}.svg`;
    if (!ep1Page.includes(relative)) throw new Error(`EP1 page does not reference ${relative}`);
    const svg = await readFile(path.join(root, relative), 'utf8');
    if (svg.includes('<image') || svg.includes('data:image/')) throw new Error(`${relative} embeds a raster source`);
    if (!svg.includes('PSO World') || !svg.includes('Sakura')) throw new Error(`${relative} is missing source attribution`);
  }
}

const expectedGeneratedFiles = new Map(languages.map((language) => [language, []]));
for (const [sourceName, [stage, area, expectedSha1]] of expectedEp2) {
  const source = await readFile(path.join(ep2SourceDirectory, sourceName));
  const sourceDimensions = pngDimensions(source);
  const actualSha1 = createHash('sha1').update(source).digest('hex');
  if (actualSha1 !== expectedSha1) throw new Error(`${sourceName} does not match the pinned Ephinea Wiki source`);
  if (sourceDimensions.width < 750 || sourceDimensions.height < 750) {
    throw new Error(`${sourceName} is below the high-resolution source floor`);
  }

  const stem = `c${stage}_area_${String(area).padStart(2, '0')}`;
  for (const language of languages) {
    const relative = `/assets/img/challenge/ep2/maps/${language}/${stem}.svg`;
    if (!ep2Page.includes(relative)) throw new Error(`EP2 page does not reference ${relative}`);
    const localeDirectory = path.join(ep2MapsDirectory, language);
    const svg = await readFile(path.join(localeDirectory, `${stem}.svg`), 'utf8');
    if (!svg.includes('Ephinea Wiki') || !svg.includes('#071a31')) {
      throw new Error(`${relative} is missing EP1 visual tokens or Ephinea attribution`);
    }
    if (svg.includes('../')) {
      throw new Error(`${relative} contains a parent-directory resource reference`);
    }
    const embeddedLayers = [...svg.matchAll(/href="data:image\/png;base64,([^"]+)"/g)];
    if (embeddedLayers.length !== 2) {
      throw new Error(`${relative} must contain exactly two self-contained PNG layers`);
    }
    for (const [, encodedLayer] of embeddedLayers) {
      const layerDimensions = pngDimensions(Buffer.from(encodedLayer, 'base64'));
      if (layerDimensions.width !== sourceDimensions.width || layerDimensions.height !== sourceDimensions.height) {
        throw new Error(`${relative} has a layer with dimensions that differ from ${sourceName}`);
      }
    }
    expectedGeneratedFiles.get(language).push(`${stem}.svg`);
  }
}

for (const language of languages) {
  await verifyInventory(
    path.join(ep2MapsDirectory, language),
    expectedGeneratedFiles.get(language),
    /\.(svg|png)$/i,
  );
}

console.log('Challenge maps verified: 42 EP1 vector maps and 25 EP2 high-resolution maps are complete in zh/en/ja.');
