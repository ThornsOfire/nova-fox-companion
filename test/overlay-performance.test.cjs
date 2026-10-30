'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fitSurface,FrameClock,AnimationClock}=require('../src/renderer/overlay-performance.js');
test('compact surface encloses all controls and keeps the logical desktop intact',()=>{
 const world={x:-1920,y:-900,width:5760,height:4100};
 const rects=[{x:300,y:500,width:150,height:180},{x:340,y:450,width:32,height:36},{x:220,y:700,width:765,height:550}];
 const next=fitSurface(rects,world,null);
 for(const r of rects){assert.ok(next.x<=r.x&&next.y<=r.y);assert.ok(next.x+next.width>=r.x+r.width);assert.ok(next.y+next.height>=r.y+r.height);}
 assert.ok(next.width*next.height<world.width*world.height/5);
 assert.deepEqual(fitSurface(rects,world,next),next);
 assert.deepEqual(fitSurface(rects,world,next,true),{x:0,y:0,width:5760,height:4100});
});
test('content at negative origins, edges and distant monitors remains bounded without losing visible regions',()=>{
 for(const world of [{width:3840,height:3200},{width:400,height:300}]){
  const rects=[{x:-10,y:-20,width:100,height:100},{x:world.width-80,y:world.height-80,width:100,height:100}];
  const result=fitSurface(rects,world,null);
  assert.equal(result.x,0);assert.equal(result.y,0);assert.equal(result.width,world.width);assert.equal(result.height,world.height);
 }
 const existing={x:1,y:2,width:640,height:480};assert.equal(fitSurface([{x:NaN,y:0,width:1,height:1}],{width:3840,height:3200},existing),existing);
});
test('surface padding prevents window moves for small motion and shrinks after chat closes',()=>{
 const world={width:3840,height:3200},fox={x:900,y:800,width:150,height:180};
 const initial=fitSurface([fox],world,null);
 assert.equal(fitSurface([{...fox,x:fox.x+20}],world,initial),initial);
 const expanded=fitSurface([fox,{x:800,y:1100,width:765,height:550}],world,initial);
 assert.ok(expanded.width*expanded.height>initial.width*initial.height);
 assert.ok(fitSurface([fox],world,expanded).width*fitSurface([fox],world,expanded).height<expanded.width*expanded.height);
});
test('render work is capped at 30 active /12 idle frames, with prompt reset',()=>{
 for(const [active,limit]of[[true,30],[false,12]]){
  const clock=new FrameClock();let frames=0;
  for(let now=0;now<1000;now+=1000/120)if(clock.due(now,active))frames++;
  assert.ok(frames<=limit);assert.ok(frames>=limit-1);
  clock.reset();assert.equal(clock.due(1001,active),true);
 }
});
test('CSS animation timing is preserved on the shared clock; hover transitions stay native',()=>{
 const clock=new AnimationClock();let pauses=0;
 const glow={currentTime:250,pause(){pauses++}},hover={currentTime:20,pause(){throw Error('Do not pause transitions')}};
 clock.advance([glow,hover],1000,a=>a===glow);assert.equal(glow.currentTime,250);
 clock.advance([glow,hover],1100,a=>a===glow);assert.equal(glow.currentTime,350);assert.equal(pauses,1);assert.equal(hover.currentTime,20);
});
