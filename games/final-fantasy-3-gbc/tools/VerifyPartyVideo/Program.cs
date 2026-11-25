using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Diagnostics;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n=1,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 uint Num(string k,int n=1){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(8*i);return v;}
 void Put(string k,byte v)=>Core.SetMemoryValue(7,Addr(k),v);
 string Mem(uint a,int n){var b=new byte[n];Core.GetMemoryValues(7,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 string Bg(int profile){if(!c.TryGetProperty("residentPatternBytes",out var sizes)||sizes.GetArrayLength()==0)return "";int n=sizes[profile].GetInt32();var bytes=new byte[n];Core.GetMemoryValues(43,8192,8192+(uint)n-1,bytes);return Convert.ToHexString(bytes).ToLowerInvariant();}
 string Vram(uint start,int n){var bytes=new byte[n];Core.GetMemoryValues(43,start,start+(uint)n-1,bytes);return Convert.ToHexString(bytes).ToLowerInvariant();}
 string Oam(){int n=c.TryGetProperty("oamBytes",out var count)?count.GetInt32():96;var b=new byte[n];Core.GetMemoryValues(44,0,(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 void Yield(){for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){if(i>20000)throw new Exception("IRQ never yields");Step(17,0);}}
 bool stone=c.TryGetProperty("stone",out var stoneMode)&&stoneMode.GetBoolean();
 bool status=c.TryGetProperty("status",out var statusMode)&&statusMode.GetBoolean();
 var audio=new List<object>();var pictures=new List<object>();
 void Observe(){Yield();var t=Core.GetTimingInfo(7);audio.Add(new{profile=Num("party_profile"),frame=Num("party_frame"),statusLoad=status?Num("status_load"):0,loadStage=c.GetProperty("symbols").TryGetProperty("party_load_stage",out var stage)?Num("party_load_stage"):0,audioBusy=Num("native_busy"),consumed=Mem(Addr("native_consumed"),12),timer=Num("native_clock",2),master=t.clock,rate=t.rate,done=Num("native_done"),late=Num("native_max_late",2),underruns=Num("native_underruns",2),error=Num("ff3_error"),videoError=Num("party_error"),memoryFault=Num("memory_fault"),transferFault=Num("text_transfer_fault"),platformError=Num("platform_error"),guard=Mem(0xddf0,16),svbk=Core.GetMemoryValue(7,0xff70)});if(Num("ff3_error")+Num("party_error")+Num("memory_fault")+Num("text_transfer_fault")+Num("native_underruns",2)+Num("native_max_late",2)!=0){File.WriteAllText(Text("output")+".failure.json",JsonSerializer.Serialize(audio));throw new Exception("Party/audio runtime fault "+JsonSerializer.Serialize(audio.Last()));}}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;Num("party_ready")!=0xa5;i++){if(i>500)throw new Exception("Boot timeout");Step();}Observe();
 var counts=c.GetProperty("counts").EnumerateArray().Select(x=>x.GetInt32()).ToArray();
 for(int p=0;p<counts.Length;p++){
  Put("party_profile",(byte)p);Put("party_request",1);
  for(int i=0;Num("party_request")!=0;i++){if(i>500)throw new Exception("Load timeout");Step();Observe();}
  for(int f=0;f<counts[p];f++){
   if(f>0){Put("party_step",1);for(int i=0;Num("party_step")!=0;i++){if(i>100)throw new Exception("Advance timeout");Step();Observe();}}
   Step(2);Observe();Audit.TakeScreenshot();var picture=new{profile=p,frame=f,bgPage=Num("resident_page"),partyPatterns=stone?Vram(0,4096):"",stoneGuard=stone?Mem(0xd900,16):"",stoneMap=stone?Vram(6144+Num("resident_page")*1024,448)+Vram(14336+Num("resident_page")*1024,448):"",stonePatterns=stone?Vram(8192+150*16+Num("resident_page")*768,768):"",statusStage=status?Num("status_stage"):0,statusState=status?Mem(Addr("status_state"),35):"",icons=status?Mem(Addr("status_source"),32):"",visible=Num("party_visible"),source=Mem(Addr("party_source"),96),oam=Oam(),bgPatterns=Bg(p),bgGuard=Mem(0xd4c0,16),terrain=Mem(0xd500,160),terrainGuard=Mem(0xd5a0,16),state=Mem(Addr("party_motion"),35)};pictures.Add(picture);
   if(stone){var e=c.GetProperty("expected")[p][f];string Expected(string k)=>e.GetProperty(k).GetString()!;var expectedOam=e.TryGetProperty("nativePages",out var no)?no[(int)picture.bgPage].GetString():Expected("native");if(picture.source!=Expected("original")||picture.state!=Expected("state")||picture.oam!=expectedOam)throw new Exception("Live original OAM/state mismatch "+p+"/"+f);}
  }
 }
 // Same artifact and loaded assets, then uninterrupted repeated live entry
 // motion across the remaining original music/SFX/fade schedule.
 var script=Audit.LoadScript("party-residency",Text("auditPath"),Text("audit"),-1);if(script<0)throw new Exception("Audit load");Put("party_pause",0);
 for(int i=0;Num("native_done")==0;i++){if(i>8500)throw new Exception("Audio schedule timeout");Step();Observe();if(i%600==0)File.AppendAllText(Text("output")+".progress.log",i+Environment.NewLine);}
 var log=new StringBuilder(3000000);Audit.GetScriptLog(script,log,3000000);File.WriteAllText(Text("output")+".lua.log",log.ToString());
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),home=Text("home"),audio,pictures,stone=stone?new {patternBytes=Num("stone_pattern_bytes",2),mapBytes=Num("stone_map_bytes",2),error=Num("stone_error")}:null,terrain=c.TryGetProperty("terrain",out var ground)&&ground.GetBoolean()?new {maxTerrainStepMs=Num("terrain_max_step",2)*1000.0/4096,terrainFault=Num("terrain_fault")}:null,resident=c.TryGetProperty("residentPatternBytes",out var sizes)&&sizes.GetArrayLength()>0?new {maxFillMs=Num("resident_max_fill",2)*1000.0/4096,maxTransferMs=Num("resident_max_transfer",2)*1000.0/4096,maxDirectServiceMs=Num("resident_max_service",2)*1000.0/4096}:null,serial=Num("party_serial",2),prepared=Num("party_prepared",2),maxPrepareTicks=Num("party_max_prepare",2),missed=Num("party_missed",2),maxGapFrames=Num("party_max_gap",2),done=Num("native_done")},new JsonSerializerOptions{WriteIndented=true}));
 }finally{Core.Stop();Core.Release();}}
}
