export interface StartupOptions {hidden:boolean;disableHardwareAcceleration:boolean;disableHardwareMediaKeys:boolean;openDevTools:boolean;search?:string;play?:string;links:string[]}
export function parseStartup(argv:string[]):StartupOptions {
 const values:Record<string,string|boolean>={};const links:string[]=[]
 for(const argument of argv){if(/^(chenjinmusic|lxmusic):\/\//i.test(argument)){links.push(argument);continue}const match=argument.match(/^--?([\w-]+)(?:=(.*))?$/);if(match)values[match[1]]=match[2]??true}
 return {hidden:values.hidden===true,disableHardwareAcceleration:values.dha===true,disableHardwareMediaKeys:values.dhmkh===true,openDevTools:values.odt===true,search:typeof values.search==='string'?values.search:undefined,play:typeof values.play==='string'?values.play:undefined,links}
}
export function parsePlaylistLaunch(input:string):{source:string;name?:string;link?:string;index:number}|null {
 const params=new URLSearchParams(input);if(params.get('type')!=='songList')return null
 const source=params.get('source')||'';if(!['myList','kw','kg','tx','wy','mg'].includes(source))return null
 return {source,name:params.get('name')||undefined,link:params.get('link')||undefined,index:Math.max(0,(parseInt(params.get('index')||'1',10)||1)-1)}
}
