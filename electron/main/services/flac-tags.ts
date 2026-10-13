import { open,rename } from 'node:fs/promises'
import { createReadStream,createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
export async function tagFlac(file:string,tags:{title:string;artist:string;album:string;lyrics?:string;cover?:Buffer}) {
 const handle=await open(file,'r');let offset=4;const kept:Buffer[]=[]
 try{
  const magic=Buffer.alloc(4);await handle.read(magic,0,4,0);if(magic.toString()!=='fLaC')throw new Error('下载文件不是有效 FLAC')
  let last=false;while(!last){const header=Buffer.alloc(4);if((await handle.read(header,0,4,offset)).bytesRead!==4)throw new Error('FLAC 元数据损坏');last=!!(header[0]&128);const type=header[0]&127,length=header.readUIntBE(1,3);if(offset+length>32*1024*1024)throw new Error('FLAC 元数据过大');const payload=Buffer.alloc(length);await handle.read(payload,0,length,offset+4);offset+=4+length;if(![1,4,6].includes(type))kept.push(Buffer.concat([Buffer.from([type,...header.subarray(1)]),payload]))}
 }finally{await handle.close()}
 const fields=[`TITLE=${tags.title}`,`ARTIST=${tags.artist}`,`ALBUM=${tags.album}`];if(tags.lyrics)fields.push(`LYRICS=${tags.lyrics}`)
 const le=(number:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(number);return b};const be=(number:number)=>{const b=Buffer.alloc(4);b.writeUInt32BE(number);return b}
 const vendor=Buffer.from('Chenjin Music');const comment=Buffer.concat([le(vendor.length),vendor,le(fields.length),...fields.flatMap(value=>{const data=Buffer.from(value);return [le(data.length),data]})])
 const block=(type:number,data:Buffer)=>{if(data.length>0xffffff)throw new Error('FLAC 标签过大');const h=Buffer.alloc(4);h[0]=type;h.writeUIntBE(data.length,1,3);return Buffer.concat([h,data])}
 kept.push(block(4,comment))
 if(tags.cover){const png=tags.cover.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const mime=Buffer.from(png?'image/png':'image/jpeg');const pic=Buffer.concat([be(3),be(mime.length),mime,be(0),be(0),be(0),be(0),be(0),be(tags.cover.length),tags.cover]);kept.push(block(6,pic))}
 kept.at(-1)![0]|=128
 const temporary=file+'.tagged';const output=createWriteStream(temporary);output.write(Buffer.concat([Buffer.from('fLaC'),...kept]));await pipeline(createReadStream(file,{start:offset}),output);await rename(temporary,file)
}
