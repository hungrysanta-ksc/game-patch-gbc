using System.Runtime.InteropServices;using System.Text.Json;using System.Diagnostics;using System.Text;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n=1,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 uint Num(string k,int n=1){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(8*i);return v;}
 uint Optional(string k)=>c.GetProperty("symbols").TryGetProperty(k,out var _) ? Num(k,2) : 0;
 void Put(string k,byte v)=>Core.SetMemoryValue(7,Addr(k),v);
 void Bytes(string k,string hex){var b=Convert.FromHexString(hex);for(uint i=0;i<b.Length;i++)Core.SetMemoryValue(7,Addr(k)+i,b[i]);}
 string Mem(int type,uint a,int n){var b=new byte[n];Core.GetMemoryValues(type,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 var audio=new List<object>();var pictures=new List<object>();var runs=new List<object>();var requests=new List<object>();uint external=0;int audit=-1;bool automatic=c.TryGetProperty("automatic",out var auto)&&auto.GetBoolean();string actionAudit="";
 void Observe(){for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){if(i>20000)throw new Exception("IRQ yield");Step(17,0);}var t=Core.GetTimingInfo(7);
  var serial=Num("native_external_serial",2);if(serial!=external){if(serial!=external+1)throw new Exception("Lost sound request");external=serial;requests.Add(new{tick=Num("native_external_tick",2),op=Num("native_external_op"),arg=Num("native_external_arg")});}
  audio.Add(new{timer=Num("native_clock",2),consumed=Mem(7,Addr("native_consumed"),12),master=t.clock,rate=t.rate,late=Num("native_max_late",2),underruns=Num("native_underruns",2),error=Num("ff3_error"),videoError=Num("party_error"),memoryFault=Num("memory_fault"),transferFault=Num("text_transfer_fault"),platformError=Num("platform_error"),guard=Mem(7,0xddf0,16)});
  if(Num("ff3_error")+Num("party_error")+Num("memory_fault")+Num("text_transfer_fault")+Num("native_underruns",2)+Num("native_max_late",2)!=0)throw new Exception("Runtime fault");
 }
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;Num("party_ready")!=0xa5;i++){if(i>500)throw new Exception("Boot timeout");Step();}Observe();
 audit=Audit.LoadScript("strike-safety",Text("auditPath"),Text("audit"),-1);if(audit<0)throw new Exception("Audit load");
 foreach(var run in c.GetProperty("cases").EnumerateArray()){
  Put("party_profile",(byte)run.GetProperty("profile").GetInt32());Put("party_request",1);for(int i=0;Num("party_request")!=0;i++){if(i>500)throw new Exception("Load timeout");Step();Observe();}
  while(Num("status_stage")!=2){Put("party_step",1);for(int i=0;Num("party_step")!=0;i++){if(i>500)throw new Exception("Entry timeout");Step();Observe();}}
  Step(2);Observe();Bytes("animation_state",run.GetProperty("animation").GetString()!);Bytes("action_script",run.GetProperty("script").GetString()!);Bytes("strike_weapons",run.GetProperty("weapons").GetString()!);Put("action_probe",0);Put("animation_video_probe",1);Put("action_request",1);
  if(automatic){Put("animation_video_probe",0);var begin=Core.GetTimingInfo(7);for(int i=0;Num("action_request")!=0||Num("action_enabled")!=0;i++){if(i>3000||Num("action_blocked")!=0)throw new Exception("Automatic strike blocked");Step();Observe();}runs.Add(new{tag=run.GetProperty("tag").GetString(),frames=Num("animation_video_frames",2),prepares=Optional("strike_prepares"),reuses=Optional("strike_reuses"),common=Mem(7,Addr("animation_state"),109),script=Mem(7,Addr("action_script"),29),elapsedMs=(Core.GetTimingInfo(7).clock-begin.clock)*1000.0/begin.rate});var actionLog=new StringBuilder(1000000);Audit.GetScriptLog(audit,actionLog,1000000);actionAudit=actionLog.ToString();continue;}
  int frames=0;while(true){
   for(int i=0;Num("animation_video_gate")==0&&(Num("action_request")!=0||Num("action_enabled")!=0);i++){if(i>500||Num("action_blocked")!=0)throw new Exception("Strike failure: "+Num("strike_error")+"/"+Num("animation_video_error")+" owner "+Num("animation_video_owner"));Step();Observe();}
   if(Num("action_blocked")!=0)throw new Exception("Blocked owner "+Num("animation_video_owner"));
   if(Num("animation_video_gate")==0)break;
   if(++frames>256||Num("animation_video_frames",2)!=frames)throw new Exception("Skipped frame");Step(2);Observe();Audit.TakeScreenshot();pictures.Add(new{tag=run.GetProperty("tag").GetString(),frame=frames,owner=Num("animation_video_owner"),source=Mem(7,Addr("animation_source"),160),party=Mem(7,Addr("party_state"),26),oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)});Put("animation_video_gate",0);
  }
  runs.Add(new{tag=run.GetProperty("tag").GetString(),frames,prepares=Optional("strike_prepares"),reuses=Optional("strike_reuses"),common=Mem(7,Addr("animation_state"),109),script=Mem(7,Addr("action_script"),29)});
 }
 for(int i=0;Num("native_done")==0;i++){if(i>10000)throw new Exception("Audio completion timeout");Step();Observe();}
 var auditLog=new StringBuilder(1000000);Audit.GetScriptLog(audit,auditLog,1000000);File.WriteAllText(Text("output")+".audit.log",actionAudit+"\n"+auditLog.ToString());
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),home=Text("home"),audio,pictures,runs,requests},new JsonSerializerOptions{WriteIndented=true}));
 }catch{File.WriteAllText(Text("output")+".failure.json",JsonSerializer.Serialize(new{audio,pictures,runs,requests}));throw;}
 finally{Core.Stop();Core.Release();}}
}
