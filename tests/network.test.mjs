import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStream} from '../src/network.js';

test('stream recovery does not open duplicate sockets while authentication is pending',async()=>{
  const previous=globalThis.WebSocket,sockets=[];
  class Socket {
    static OPEN=1;static CONNECTING=0;
    constructor(){this.readyState=0;sockets.push(this);}
    close(){this.readyState=3;this.onclose?.();}
  }
  globalThis.WebSocket=Socket;
  let resolveToken;const token=new Promise(resolve=>{resolveToken=resolve;});
  const stream=new RoomStream({access:()=>token},'test-room',()=>{},()=>{});
  try{
    stream.reconnectNow();stream.reconnectNow();resolveToken('test-token');await token;await Promise.resolve();
    assert.equal(sockets.length,1);
    stream.reconnectNow();assert.equal(sockets.length,1,'a connecting socket is retained');
    sockets[0].readyState=1;stream.reconnectNow();assert.equal(sockets.length,1,'an open socket is retained');
    sockets[0].close();stream.reconnectNow();await Promise.resolve();
    assert.equal(sockets.length,2,'a dropped connection can recover immediately');
  }finally{stream.close();globalThis.WebSocket=previous;}
});

test('leaving a room while authentication is pending cannot resurrect its stream',async()=>{
  const previous=globalThis.WebSocket;let opened=0,resolveToken;
  globalThis.WebSocket=class{constructor(){opened++;}};
  const token=new Promise(resolve=>{resolveToken=resolve;});
  const stream=new RoomStream({access:()=>token},'old-room',()=>{},()=>{});
  try{stream.close();resolveToken('test-token');await token;await Promise.resolve();assert.equal(opened,0);}
  finally{stream.close();globalThis.WebSocket=previous;}
});
