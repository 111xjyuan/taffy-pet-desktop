// 把 DSH 版已经攒下的素材复制到独立版的 assets/（只补缺，不覆盖）
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, '..', 'assets');
const home = homedir();

const pairs = [
  [join(home, '.dsh', 'taffy-pet', 'art'), join(dest, 'art')],
  [join(home, '.dsh', 'whale-audio'), join(dest, 'audio')],
  [join(home, '.dsh', 'taffy-pet', 'vrm'), join(dest, 'vrm')]
];

for (const [src, dst] of pairs) {
  if (!existsSync(src)) { console.log('skip (not found):', src); continue; }
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true, force: false, errorOnExist: false });
  console.log('copied:', src, '->', dst);
}
console.log('done. assets at', dest);
