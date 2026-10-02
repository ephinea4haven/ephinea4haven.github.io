import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Requires the WebP tools (cwebp). Generated images are committed, so ordinary
// site builds do not need an image encoder. Keep the full, uncropped source.
const root = new URL('../', import.meta.url);
const source = fileURLToPath(new URL('content/site-images/lobby-overlook.webp', root));
for (const [name, width] of [['mobile', 1440], ['desktop', 2160]]) {
  const output = fileURLToPath(new URL(`assets/img/bg/lobby-overlook-${name}.webp`, root));
  execFileSync('cwebp', ['-q', '55', '-m', '6', '-resize', String(width), '0', source, '-o', output], {
    stdio: 'inherit',
  });
}
