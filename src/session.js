/** Shared session-state presentation. Expiry closes admission even if status is still open. */
export function sessionState(room,now=Date.now()){
  if(!room)return {label:'No session',open:false,detail:'Create a session to admit students.'};
  const expired=Date.parse(room.expires_at)<=now,open=room.status==='open'&&!expired;
  if(open)return{label:'Open',open:true,detail:'Students can join and upload measurements.'};
  const draining=!expired&&Date.parse(room.accept_until)>now;
  return{label:expired?'Expired':'Ended',open:false,detail:draining?'Joining is closed. Already joined students can finish queued uploads until '+new Date(room.accept_until).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'.':'Joining and uploads are closed. Saved results remain available.'};
}
export function sessionLabel(room){return `${room.title} · ${sessionState(room).label} · ${new Date(room.created_at).toLocaleDateString()}`;}
