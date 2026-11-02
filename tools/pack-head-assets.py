"""Lossless head attribute packing; retains the existing quantization and indices."""
import base64,json,struct,sys
from pathlib import Path

def pack(raw,position):
 values=struct.unpack('<'+'h'*(len(raw)//2),raw) if position else raw
 mask=65535 if position else 255;half=(mask+1)//2;previous=[0,0,0];out=bytearray();zeros=0
 def varint(n):
  while n>=128:out.append((n&127)|128);n>>=7
  out.append(n)
 for i,n in enumerate(values):
  delta=((n-previous[i%3]+half)&mask)-half;previous[i%3]=n
  if delta==0:zeros+=1;continue
  if zeros:varint(0);varint(zeros);zeros=0
  varint(delta*2 if delta>0 else -delta*2-1)
 if zeros:varint(0);varint(zeros)
 return bytes(out)

def repack(path):
 path=Path(path);s=path.read_text(encoding='utf-8');prefix,payload=s.split('window.KM_HEAD_ASSETS=',1);data=json.loads(payload.strip().rstrip(';'))
 if data['version']==3:return
 if data['version']!=2:raise ValueError('Expected head asset version 2')
 for actor in data['cast'].values():
  for parts in actor['lod'].values():
   for mesh in parts.values():
    encoding={}
    for key in ['p','n','c']:
     if key not in mesh:continue
     raw=base64.b64decode(mesh[key]);packed=pack(raw,key=='p')
     if len(packed)<len(raw):mesh[key]=base64.b64encode(packed).decode();encoding[key]='delta-rle-v1'
    if encoding:mesh['encoding']=encoding
 data['version']=3
 path.write_text(prefix+'window.KM_HEAD_ASSETS='+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8',newline='\n')
 print(json.dumps({'path':str(path),'beforeBytes':len(s.encode()),'afterBytes':path.stat().st_size}))
if __name__=='__main__':repack(sys.argv[1])
