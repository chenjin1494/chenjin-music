import type { Lyrics,Track } from '../../../src/shared/types'
import { readFile,writeFile,mkdir,rename,readdir,unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
export class LyricCache {
 constructor(private directory:string){}
 private file(track:Track){return path.join(this.directory,createHash('sha256').update(track.id).digest('hex')+'.json')}
 async get(track:Track):Promise<Lyrics|null>{try{const result=JSON.parse(await readFile(this.file(track),'utf8'));if(typeof result.lyric!=='string')return null;return result}catch{return null}}
 async set(track:Track,lyrics:Lyrics,allowEmpty=false){if(!allowEmpty&&!lyrics.lyric&&!lyrics.lxlyric)return;await mkdir(this.directory,{recursive:true});const file=this.file(track),temp=file+'.tmp';await writeFile(temp,JSON.stringify(lyrics));await rename(temp,file)}
 async count(ids:string[]=[]){const files=await readdir(this.directory).catch(()=>[]);return new Set([...ids.map(id=>createHash('sha256').update(id).digest('hex')),...files.filter(name=>/^[a-f0-9]{64}\.json$/.test(name)).map(name=>name.slice(0,-5))]).size}
 async remove(track:Track){await unlink(this.file(track)).catch(error=>{if(error.code!=='ENOENT')throw error})}
 async clear(){const files=await readdir(this.directory).catch(()=>[]);for(const name of files)if(/^[a-f0-9]{64}\.json$/.test(name))await unlink(path.join(this.directory,name))}
}
