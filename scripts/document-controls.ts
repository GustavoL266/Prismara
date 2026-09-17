import {readFileSync,writeFileSync} from 'node:fs';
import {CONTROLS} from '../src/game/input';
const file='README.md',source=readFileSync(file,'utf8');
const table=['| Controle | Ação |','| --- | --- |',...CONTROLS.map(c=>'| '+c.keys+' | '+c.label+' |')].join('\n');
writeFileSync(file,source.replace(/<!-- controls:start -->[\s\S]*?<!-- controls:end -->/,'<!-- controls:start -->\n'+table+'\n<!-- controls:end -->'));
console.log('Controles atualizados a partir de src/game/input.ts');
