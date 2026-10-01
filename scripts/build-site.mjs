import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
await mkdir('dist/site',{recursive:true});
for(const file of ['index.html','style.css','script.js','launch.json','privacy.html','terms.html','support.html','privacy.js','_headers'])await copyFile(file,`dist/site/${file}`);
await rm('dist/site/assets',{recursive:true,force:true});
await cp('assets','dist/site/assets',{recursive:true,filter:source=>!source.endsWith('.md')});
console.log('Built static site with explicit public-file allowlist.');
