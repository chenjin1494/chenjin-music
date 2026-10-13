export interface SystemMediaTrack {name:string;singer?:string;meta:{albumName?:string;picUrl?:string|null}}
export interface SystemMediaSnapshot {track?:SystemMediaTrack;state:string;duration:number;position:number;rate:number}
export interface SystemMediaControls {play:()=>void|Promise<void>;pause:()=>void;stop:()=>void;next:()=>void|Promise<void>;previous:()=>void|Promise<void>;seek:(position:number)=>void;position:()=>number;duration:()=>number}
const actions:MediaSessionAction[]=['play','pause','stop','previoustrack','nexttrack','seekbackward','seekforward','seekto']
/** Chromium owns the Windows SMTC connection; no global media-key interception. */
export function createSystemMediaSession(controls:SystemMediaControls,session:MediaSession|undefined=typeof navigator==='undefined'?undefined:navigator.mediaSession,Metadata:typeof MediaMetadata|undefined=typeof MediaMetadata==='undefined'?undefined:MediaMetadata){
 let metadataKey='',disposed=false
 const safely=(action:()=>void)=>{try{action()}catch{/* Unsupported system actions must never interrupt audio. */}}
 const run=(action:()=>void|Promise<void>)=>{try{void Promise.resolve(action()).catch(()=>{})}catch{}}
 const seek=(position:number)=>{const duration=controls.duration();if(Number.isFinite(position)&&Number.isFinite(duration)&&duration>0)controls.seek(Math.max(0,Math.min(duration,position)))}
 const handlers:Partial<Record<MediaSessionAction,MediaSessionActionHandler>>={play:()=>run(controls.play),pause:()=>run(controls.pause),stop:()=>run(controls.stop),previoustrack:()=>run(controls.previous),nexttrack:()=>run(controls.next),seekbackward:event=>seek(controls.position()-(event.seekOffset??5)),seekforward:event=>seek(controls.position()+(event.seekOffset??5)),seekto:event=>{if(event.seekTime!==undefined)seek(event.seekTime)}}
 if(session)for(const action of actions)safely(()=>session.setActionHandler(action,handlers[action]!))
 return {
  update(snapshot:SystemMediaSnapshot){
   if(!session||disposed)return
   const track=snapshot.track,active=!!track&&!['stoped','error'].includes(snapshot.state)
   if(!active){metadataKey='';safely(()=>session.playbackState='none');safely(()=>session.metadata=null);safely(()=>session.setPositionState());return}
   const pic=track.meta.picUrl??'',artwork=/^https?:\/\//i.test(pic)||/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(pic)?[{src:pic}]:[]
   const metadata={title:track.name,artist:track.singer??'',album:track.meta.albumName??'',artwork},key=JSON.stringify(metadata)
   if(Metadata&&key!==metadataKey)safely(()=>{session.metadata=new Metadata(metadata);metadataKey=key})
   safely(()=>session.playbackState=snapshot.state==='playing'?'playing':'paused')
   const duration=snapshot.duration
   if(Number.isFinite(duration)&&duration>0&&Number.isFinite(snapshot.position))safely(()=>session.setPositionState({duration,position:Math.max(0,Math.min(duration,snapshot.position)),playbackRate:Number.isFinite(snapshot.rate)&&snapshot.rate>0?snapshot.rate:1}))
   else safely(()=>session.setPositionState())
  },
  dispose(){if(disposed)return;disposed=true;if(session){for(const action of actions)safely(()=>session.setActionHandler(action,null));safely(()=>session.playbackState='none');safely(()=>session.metadata=null);safely(()=>session.setPositionState())}}
 }
}
