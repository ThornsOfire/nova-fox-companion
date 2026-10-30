# Analyze the source alpha channel and write frame metadata only. Never rewrites the artwork.
from pathlib import Path
import json
from PIL import Image
im=Image.open('assets/avatars/nova-spirit-fox/spritesheet.png').convert('RGBA')
w,h=im.size; pixels=im.load(); seen=bytearray(w*h); boxes=[]
for y in range(h):
 for x in range(w):
  if seen[y*w+x] or pixels[x,y][3]<90: continue
  todo=[(x,y)];seen[y*w+x]=1;count=0;left=right=x;top=bottom=y
  while todo:
   xx,yy=todo.pop();count+=1;left=min(left,xx);right=max(right,xx);top=min(top,yy);bottom=max(bottom,yy)
   for nx,ny in [(xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)]:
    if 0<=nx<w and 0<=ny<h and not seen[ny*w+nx] and pixels[nx,ny][3]>=90:
     seen[ny*w+nx]=1;todo.append((nx,ny))
  if count>700:boxes.append((left,top,right+1,bottom+1))
p=Path('assets/avatars/nova-spirit-fox/pet.json');data=json.loads(p.read_text(encoding='utf-8'))
bands=[('idle',0,155,360,5),('right',155,280,110,8),('left',280,400,110,8),('wave',400,555,220,4),('sleep',555,674,650,5),('carried',674,815,180,8),('waiting',815,960,350,5),('working',960,1090,300,5),('review',1090,1236,350,5)]
for name,low,high,duration,expected in bands:
 frames=sorted([b for b in boxes if low<=b[1]<high])
 assert len(frames)==expected,(name,len(frames))
 data['frameAtlas']['animations'][name]=[dict(x=l,y=t,width=r-l,height=b-t,duration=duration) for l,t,r,b in frames]
data['frameAtlas']['animations']['carried']=[data['frameAtlas']['animations']['carried'][i] for i in [0,1,4,5]]
for frame in data['frameAtlas']['animations']['carried']:frame['duration']=300
data['frameAtlas']['referenceWidth']=144;data['frameAtlas']['referenceHeight']=150
p.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
