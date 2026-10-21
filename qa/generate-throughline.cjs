const fs=require('node:fs/promises');
const sharp=require(process.argv[2]||'sharp');
const ink='#1E1B18',cream='#FFF8EE',yellow='#FFD66B';
function ribbon(color=ink,gap=cream){return `<g transform="rotate(-22 64 64)"><path d="M64 64C48 44 40 42 30 48C16 58 19 82 35 82C48 82 53 72 64 64C75 56 80 46 93 46C110 46 112 70 100 79C88 89 76 80 64 64Z" fill="none" stroke="${color}" stroke-width="17" stroke-linejoin="round"/><path d="M55 55L73 73" stroke="${gap}" stroke-width="23"/><path d="M57 57L71 71" stroke="${yellow}" stroke-width="17"/></g>`;}
const svg=(body,box='0 0 128 128')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" fill="none"><title>SoloDesk Throughline</title>${body}</svg>`;
(async()=>{
 const dir='public/brand';await fs.mkdir(dir,{recursive:true});
 const mark=svg(ribbon()),dark=svg(ribbon(cream,ink));
 const icon=svg(`<rect width="128" height="128" rx="30" fill="${cream}"/>${ribbon()}`);
 const darkIcon=svg(`<rect width="128" height="128" rx="30" fill="${ink}"/>${ribbon(cream,ink)}`);
 const wordmark=dark=>svg(`<g transform="translate(0 -4) scale(.8)">${ribbon(dark?cream:ink,dark?ink:cream)}</g><text x="118" y="77" fill="${dark?cream:ink}" font-family="Segoe UI,Arial,sans-serif" font-size="60" font-weight="800" letter-spacing="-2">SoloDesk</text>`,'0 0 400 108');
 for(const [name,content] of Object.entries({'throughline-symbol.svg':mark,'throughline-symbol-dark.svg':dark,'throughline-mark.svg':icon,'throughline-mark-dark.svg':darkIcon,'solodesk-mark.svg':icon,'solodesk-logo.svg':wordmark(false),'solodesk-logo-dark.svg':wordmark(true)}))await fs.writeFile(dir+'/'+name,content+'\n');
 for(const size of [32,180,192,512,1024])await sharp(Buffer.from(icon)).resize(size,size).png().toFile(`${dir}/throughline-${size}.png`);
 await sharp(Buffer.from(darkIcon)).resize(1024,1024).png().toFile(dir+'/throughline-dark-1024.png');
 for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]])await fs.copyFile(`${dir}/throughline-${size}.png`,dir+'/'+name);
 // The complete symbol stays inside the central mask-safe circle.
 const mask=svg(`<rect width="128" height="128" fill="${cream}"/><g transform="translate(19.2 19.2) scale(.7)">${ribbon()}</g>`);
 await sharp(Buffer.from(mask)).resize(512,512).png().toFile(dir+'/throughline-maskable-512.png');await fs.copyFile(dir+'/throughline-maskable-512.png',dir+'/icon-maskable-512.png');
 for(const [name,content] of [['solodesk-logo.png',wordmark(false)],['solodesk-logo-dark.png',wordmark(true)]])await sharp(Buffer.from(content)).resize({width:1600}).png().toFile(dir+'/'+name);
 const social=svg(`<rect width="1200" height="630" rx="0" fill="${cream}"/><g transform="translate(75 155) scale(2.4)">${ribbon()}</g><text x="430" y="315" fill="${ink}" font-family="Segoe UI,Arial,sans-serif" font-size="112" font-weight="800" letter-spacing="-4">SoloDesk</text><text x="435" y="380" fill="${ink}" font-family="Segoe UI,Arial,sans-serif" font-size="28">Independent work. All together.</text>`,'0 0 1200 630');
 await sharp(Buffer.from(social)).png().toFile(dir+'/throughline-share.png');
 console.log('Throughline SVGs, app icons, transparent logo PNGs and share image generated.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
