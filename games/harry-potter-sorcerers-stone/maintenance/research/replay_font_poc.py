"""Exact-file cold boot and controller replay; adapted from the HP2 libretro host."""
import ctypes as C,hashlib,json,sys
from pathlib import Path

from PIL import Image
import numpy as np
class Variable(C.Structure):_fields_=[('key',C.c_char_p),('value',C.c_char_p)]
class Info(C.Structure):_fields_=[('path',C.c_char_p),('data',C.c_void_p),('size',C.c_size_t),('meta',C.c_char_p)]
class SystemInfo(C.Structure):_fields_=[('name',C.c_char_p),('version',C.c_char_p),('extensions',C.c_char_p),('fullpath',C.c_bool),('extract',C.c_bool)]
ENV=C.CFUNCTYPE(C.c_bool,C.c_uint,C.c_void_p)
VIDEO=C.CFUNCTYPE(None,C.c_void_p,C.c_uint,C.c_uint,C.c_size_t)
AUDIO=C.CFUNCTYPE(None,C.c_int16,C.c_int16)
BATCH=C.CFUNCTYPE(C.c_size_t,C.c_void_p,C.c_size_t)
POLL=C.CFUNCTYPE(None)
INPUT=C.CFUNCTYPE(C.c_int16,C.c_uint,C.c_uint,C.c_uint,C.c_uint)
LOG=C.CFUNCTYPE(None,C.c_int,C.c_char_p)
@LOG
def log(level,fmt):pass
rom=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
route=json.loads(Path(sys.argv[4]).read_text(encoding='utf-8')); max_frame=route['frames']
dll=Path(sys.argv[3] if len(sys.argv)>3 else 'work/battle-flicker-v133/gambatte/gambatte_libretro.dll').resolve();core=C.CDLL(str(dll))
directory=str(out.resolve()).encode();variables={};ctx={'pixel':0,'frame':0,'keys':set()};records=[];interventions=[]
@ENV
def env(cmd,data):
 if cmd==27:C.cast(data,C.POINTER(C.c_void_p))[0]=C.cast(log,C.c_void_p).value;return True
 if cmd==10:ctx['pixel']=C.cast(data,C.POINTER(C.c_int))[0];return ctx['pixel'] in (0,1,2)
 if cmd in (9,31):C.cast(data,C.POINTER(C.c_char_p))[0]=directory;return True
 if cmd==3:C.cast(data,C.POINTER(C.c_bool))[0]=True;return True
 if cmd==16:
  v=C.cast(data,C.POINTER(Variable));i=0
  while v[i].key:
   variables[v[i].key]=v[i].value.split(b'; ',1)[-1].split(b'|')[0];i+=1
  return True
 if cmd==15:
  v=C.cast(data,C.POINTER(Variable));v[0].value=variables.get(v[0].key);return v[0].value is not None
 if cmd==17:C.cast(data,C.POINTER(C.c_bool))[0]=False;return True
 if cmd in (8,11,18,35):return True
 return False
@VIDEO
def video(data,w,h,pitch):
 if not data:return
 f=ctx['frame']
 if f not in route['screenshots']:return
 b=C.string_at(data,pitch*h)
 if ctx['pixel']==1:im=Image.frombytes('RGB',(w,h),b,'raw','BGRX',pitch)
 else:
  a=np.frombuffer(b,dtype='<u2').reshape(h,pitch//2)[:,:w];five=ctx['pixel']==0
  r=(a>>(10 if five else 11))&31;g=(a>>5)&(31 if five else 63);bl=a&31
  rgb=np.stack((r*255//31,g*255//(31 if five else 63),bl*255//31),axis=-1).astype('uint8');im=Image.fromarray(rgb)
 im.save(out/f'{f:04}.png')
 records.append({'frame':f,'sha256':hashlib.sha256(im.tobytes()).hexdigest()})
@AUDIO
def audio(l,r):pass
@BATCH
def batch(data,n):return n
@POLL
def poll():pass
@INPUT
def input_state(port,device,index,key):return int(port==0 and device==1 and key in ctx['keys'])
for name,callback,typ in [('environment',env,ENV),('video_refresh',video,VIDEO),('audio_sample',audio,AUDIO),('audio_sample_batch',batch,BATCH),('input_poll',poll,POLL),('input_state',input_state,INPUT)]:
 fn=getattr(core,'retro_set_'+name);fn.argtypes=[typ];fn(callback)
core.retro_init()
info=SystemInfo();core.retro_get_system_info.argtypes=[C.POINTER(SystemInfo)];core.retro_get_system_info(C.byref(info))
data=rom.read_bytes();buf=C.create_string_buffer(data);game=Info(str(rom.resolve()).encode(),C.cast(buf,C.c_void_p),len(data),None)
core.retro_load_game.argtypes=[C.POINTER(Info)];core.retro_load_game.restype=C.c_bool
assert core.retro_load_game(C.byref(game))
core.retro_set_controller_port_device.argtypes=[C.c_uint,C.c_uint]
core.retro_set_controller_port_device(0,1)
core.retro_get_memory_data.argtypes=[C.c_uint];core.retro_get_memory_data.restype=C.c_void_p
core.retro_get_memory_size.argtypes=[C.c_uint];core.retro_get_memory_size.restype=C.c_size_t
save_path = route.get('initial_sram')
if save_path:
 save = Path(save_path).read_bytes()
 assert len(save) == core.retro_get_memory_size(0)
 C.memmove(core.retro_get_memory_data(0), save, len(save))
if __name__ == '__main__':
 audit=route.get('audit_memory_layout',False)
 audit_rows=[];audit_armed=False;audit_seen=0;audit_min_stack=112
 if audit:
  manifest=json.loads((rom.parent/'manifest.json').read_text(encoding='utf-8'))
  resident=bytes.fromhex(manifest['module_hex'])[0x20:0x250]
  assert len(resident)==0x230
 for f in range(1,max_frame+1):
  ctx['frame']=f
  for edit in route.get('memory_edits',[]):
   if edit['at']!=f:continue
   size=core.retro_get_memory_size(2);pointer=core.retro_get_memory_data(2)
   before=bytes.fromhex(edit['expected_hex']);after=bytes.fromhex(edit['replacement_hex']);offset=edit['physical_wram_offset']
   if len(before)!=len(after) or not pointer or offset<0 or offset+len(after)>size:raise ValueError('Invalid research state edit')
   observed=C.string_at(pointer+offset,len(before))
   if observed!=before:raise ValueError(f'Research state precondition failed: {edit["reason"]}: {observed.hex()}')
   C.memmove(pointer+offset,after,len(after));interventions.append(edit)
  if f in route.get('reset_frames',[]):
   core.retro_reset();audit_armed=False
  ctx['keys']={event['key'] for event in route['inputs'] if event['at']<=f<event['at']+event.get('duration',2)}
  core.retro_run()
  if audit:
   size=core.retro_get_memory_size(2);pointer=core.retro_get_memory_data(2)
   assert size==0x8000 and pointer
   ram=C.string_at(pointer,size)
   if ram[0x7da0:0x7fd0]==resident:audit_armed=True
   if audit_armed:
    audit_seen+=1
    if ram[0x7da0:0x7fd0]!=resident:
     audit_rows.append({'frame':f,'changed_module_offsets':[i for i,(a,b) in enumerate(zip(ram[0x7da0:0x7fd0],resident)) if a!=b]})
    mark=ram[0xf80:0xff0]
    audit_min_stack=min(audit_min_stack,len(mark)-len(mark.lstrip(bytes([0x69]))))
  if f in route['screenshots']:
   size=core.retro_get_memory_size(2); pointer=core.retro_get_memory_data(2)
   if pointer and size:(out/f'{f:04}.ram').write_bytes(C.string_at(pointer,size))
   if route.get('capture_sram',False):
    size=core.retro_get_memory_size(0);pointer=core.retro_get_memory_data(0)
    if pointer and size:(out/f'{f:04}.sram').write_bytes(C.string_at(pointer,size))
 result={'core_name':info.name.decode(),'core_version':info.version.decode(),'core_sha256':hashlib.sha256(dll.read_bytes()).hexdigest(),'rom_sha256':hashlib.sha256(data).hexdigest(),'save_loaded':False,'input_route':route,'variables':{k.decode():v.decode() for k,v in variables.items()},'frames':records,'scope':'Cold boot without loaded save, normal controller route, Windows libretro '+info.name.decode()}
 if save_path:
  result.update(save_loaded=True,save_sha256=hashlib.sha256(save).hexdigest(),scope='Cold boot with a copy of battery SRAM; controller input')
 if interventions:
  result['state_interventions']=interventions
  result['scope']='Controlled prerequisite state followed by controller input; not an acquisition/progression proof'
 if audit:
  result['memory_layout_audit']={'frames_after_module_load':audit_seen,'module_mismatches':audit_rows,'minimum_untouched_stack_watermark_bytes':audit_min_stack,'scope':'Every frame boundary after complete module load; transient accesses between frames are not observed'}
  (out/'memory-audit.json').write_text(json.dumps(result['memory_layout_audit'],indent=2))
  assert audit_seen>0 and not audit_rows and audit_min_stack>0,result['memory_layout_audit']
 (out/'trace.json').write_text(json.dumps(result,indent=2));core.retro_unload_game();core.retro_deinit()
 print({**{k:result[k] for k in ('core_name','core_version','core_sha256','rom_sha256','save_loaded')},'frames_run':max_frame,'input_events':len(route['inputs']),'reset_frames':route.get('reset_frames',[]),'trace':str(out/'trace.json')})
