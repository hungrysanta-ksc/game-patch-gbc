using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(){var before=Core.GetTimingInfo(7).clock;Core.Step(7,1,6);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Check(bool ok,string s){if(!ok)throw new Exception(s);}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 uint Num(string k,int n=1){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(8*i);return v;}
 void Put(string k,byte v)=>Core.SetMemoryValue(7,Addr(k),v);
 byte F(uint i)=>Core.GetMemoryValue(7,Addr("field")+i);void SetF(uint i,byte v)=>Core.SetMemoryValue(7,Addr("field")+i,v);
 string Mem(int type,uint at,int n){var b=new byte[n];Core.GetMemoryValues(type,at,at+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 bool field=Text("mode")=="field";var audio=new List<object>();var cycles=new List<object>();int tailCases=0;
 void Observe(){for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){Check(i<1000,"IRQ yield");var before=Core.GetTimingInfo(7).clock;Core.Step(7,17,0);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
  uint faults=Num("ff3_error")+Num("native_underruns",2)+Num("native_max_late",2)+Num("memory_fault")+Num("text_transfer_fault")+(field?(uint)(F(16)+F(39)):Num("party_error"));Check(faults==0,"Endpoint audio/video fault "+faults);
  audio.Add(new{consumed=Mem(7,Addr("native_consumed"),12),owner=Num("scene_video_owner"),faults});
 }
 void Frames(int n){for(int i=0;i<n;i++){Step();Observe();}}
 void Until(Func<bool> f,string label){for(int i=0;!f();i++){Check(i<600,"Timeout "+label);Frames(1);}}
 void Request(byte r){if(field){SetF(20,r);Until(()=>F(20)==0,"field request");if(r==12||r==13)Check(F(21)==1,"Field handoff result");Until(()=>F(47)==0&&F(65)==0,"field drain");}else{Put("party_request",r);Until(()=>Num("party_request")==0&&Num("party_pending")==0&&Num("party_work")==0,"battle request");}Frames(2);}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});Check(Core.LoadRom(Text("rom"),IntPtr.Zero),"ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
  for(int i=0;field?F(26)!=0xa5:Num("party_ready")!=0xa5;i++){Check(i<600,"Boot");Step();}
  if(field){SetF(27,1);Put("native_request",255);for(int i=0;Num("native_request")!=0;i++){Check(i<600,"Audio diagnostic start");Step();}}
  Frames(5);if(field){Until(()=>F(64)==0&&F(72)==0&&F(47)==0&&F(65)==0,"field idle");
   // Controlled transfer descriptors, not player/NPC state. Exercise the
   // final two pairs of a real column IRQ using its existing staging bytes.
   for(int i=0;i<64;i++){
    Put("strip_stride",32);Put("strip_index",30);Put("strip_address",0);Core.SetMemoryValue(7,Addr("strip_address")+1,0x9f);SetF(65,1);
    Frames(2);Check(F(65)==0&&Num("strip_index")==32,"Column tail overrun/starvation");tailCases++;
   }
  }
  foreach(int profile in field?new[]{0}:new[]{0,3}){
   if(!field){Put("party_profile",(byte)profile);Request(1);}
   for(int cycle=0;cycle<2;cycle++){
    string state=Mem(7,Addr("ff3_game_state"),1024),vram=Mem(43,0,16384),objects=field?Mem(7,Addr("object_part1"),192):"";uint ticks=Num("native_consumed",4);
    Request(field?(byte)12:(byte)2);Check(Num("scene_video_owner")==0&&Num("_shadow_OAM_base")==0,"Detached DMA/owner");
    if(!field)Check((Core.GetMemoryValue(7,0xffff)&2)==0&&(Core.GetMemoryValue(7,0xff41)&0x78)==0,"Terrain LCD handler disabled");
    Frames(8);Check(Mem(43,0,16384)==vram,"Detached VRAM writer");Check(Num("native_consumed",4)>ticks,"Audio stopped during detach");
    Request(field?(byte)13:(byte)3);if(!field)Request(1);
    Check(Num("scene_video_owner")== (field?1u:2u),"Reattached owner");
    Check(Mem(7,Addr("ff3_game_state"),1024)==state,"Persistent state reset");
    if(field)Check(Mem(7,Addr("object_part1"),192)==objects,"NPC state reset");else Check(Mem(43,0,16384)==vram,"Battle reload changes resident bytes");
    cycles.Add(new{profile,cycle,owner=Num("scene_video_owner"),ticks=Num("native_consumed",4),statePreserved=true,detachedVramUnchanged=true});
   }
  }
  File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),mode=Text("mode"),tailCases,cycles,audio}));
 }finally{Core.Stop();Core.Release();}}
}
