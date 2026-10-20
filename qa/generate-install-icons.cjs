// Render the existing vector mark, leaving room for platform icon masks.
// Pass the path to a Sharp installation; this is a build-time asset utility only.
const fs=require('node:fs/promises');
const sharp=require(process.argv[2] || 'sharp');
(async()=>{
  const svg=await fs.readFile('public/brand/solodesk-mark.svg');
  for(const [name,size,maskable] of [['icon-192.png',192,false],['icon-512.png',512,false],['apple-touch-icon.png',180,false],['icon-maskable-512.png',512,true]]){
    const markSize=Math.round(size*.75),mark=await sharp(svg).resize(markSize,markSize).png().toBuffer();
    await sharp({create:{width:size,height:size,channels:4,background:maskable?'#ffd66b':'#fff8ee'}}).composite([{input:mark,gravity:'centre'}]).png().toFile('public/brand/'+name);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
