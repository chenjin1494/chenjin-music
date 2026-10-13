const searches=new Map<string,unknown>()
export function readSearchSession<T>(key:string):T|undefined{return searches.get(key) as T|undefined}
export function saveSearchSession(key:string,value:unknown):void{if(!searches.has(key)&&searches.size>=8)searches.delete(searches.keys().next().value!);searches.set(key,value)}
export function clearSearchSession():void{searches.clear()}
