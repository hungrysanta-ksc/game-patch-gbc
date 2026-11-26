using System.Runtime.InteropServices;using System.Text.Json;using System.Diagnostics;using System.Text;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n=1,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 uint Num(string k,int n=1){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(8*i);return v;}
 void Put(string k,byte v)=>Core.SetMemoryValue(7,Addr(k),v);
 void Bytes(string k,string hex){var b=Convert.FromHexString(hex);for(uint i=0;i<b.Length;i++)Core.SetMemoryValue(7,Addr(k)+i,b[i]);}
 string Mem(int type,uint a,int n){var b=new byte[n];Core.GetMemoryValues(type,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 var audio=new List<object>();var pictures=new List<object>();var runs=new List<object>();bool automatic=c.TryGetProperty("automatic",out var auto)&&auto.GetBoolean();int audit=-1;
 void Observe(){for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){if(i>20000)throw new Exception("IRQ yield");Step(17,0);}var t=Core.GetTimingInfo(7);audio.Add(new{timer=Num("native_clock",2),consumed=Mem(7,Addr("native_consumed"),12),master=t.clock,rate=t.rate,late=Num("native_max_late",2),underruns=Num("native_underruns",2),error=Num("ff3_error"),videoError=Num("party_error"),memoryFault=Num("memory_fault"),transferFault=Num("text_transfer_fault"),platformError=Num("platform_error"),freezeStage=Num("effect_freeze_stage"),freezeError=Num("effect_freeze_error"),guard=Mem(7,0xddf0,16)});if(Num("ff3_error")+Num("party_error")+Num("memory_fault")+Num("text_transfer_fault")+Num("native_underruns",2)+Num("native_max_late",2)!=0){File.WriteAllText(Text("output")+".failure.json",JsonSerializer.Serialize(audio));throw new Exception("Runtime fault");}}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;Num("party_ready")!=0xa5;i++){if(i>500)throw new Exception("Boot timeout");Step();}Observe();
 audit=Audit.LoadScript("effects-safety",Text("auditPath"),Text("audit"),-1);if(audit<0)throw new Exception("Audit load");
 foreach(var run in c.GetProperty("cases").EnumerateArray()){
  Put("party_profile",(byte)run.GetProperty("profile").GetInt32());Put("party_request",1);for(int i=0;Num("party_request")!=0;i++){if(i>500)throw new Exception("Load timeout");Step();Observe();}
  while(Num("status_stage")!=2){Put("party_step",1);for(int i=0;Num("party_step")!=0;i++){if(i>500)throw new Exception("Entry timeout");Step();Observe();}}
  Step(2);Observe();Bytes("animation_state",run.GetProperty("animation").GetString()!);Bytes("action_script",run.GetProperty("script").GetString()!);Put("action_probe",0);Put("animation_video_probe",1);Put("action_request",1);
  var begun=Core.GetTimingInfo(7);if(automatic){Put("animation_video_probe",0);for(int i=0;Num("action_request")!=0||Num("action_enabled")!=0;i++){if(i>1000||Num("action_blocked")!=0)throw new Exception("Autonomous numeral failure");Step();Observe();}runs.Add(new{tag=run.GetProperty("tag").GetString(),frames=Num("animation_video_frames",2),elapsedMs=(Core.GetTimingInfo(7).clock-begun.clock)*1000.0/begun.rate});continue;}
  for(int frame=0;frame<32;frame++){
   for(int i=0;Num("animation_video_gate")==0;i++){if(i>500||Num("action_blocked")!=0)throw new Exception("Numeral frame failed "+frame+"/"+Num("animation_video_error")+" freeze "+Num("effect_freeze_stage")+"/"+Num("effect_freeze_error"));Step();Observe();}
   if(Num("animation_video_frames",2)!=frame+1)throw new Exception("Skipped numeral frame");Step(2);Observe();Audit.TakeScreenshot();pictures.Add(new{tag=run.GetProperty("tag").GetString(),frame,signed=Num("effect_signed"),source=Mem(7,Addr("animation_source"),160),oam=Mem(44,0,160)});Put("animation_video_gate",0);
  }
  for(int i=0;Num("action_request")!=0||Num("action_enabled")!=0;i++){if(i>500||Num("action_blocked")!=0)throw new Exception("Action completion failed");Step();Observe();}
  Step(2);Observe();Audit.TakeScreenshot();pictures.Add(new{tag=run.GetProperty("tag").GetString(),frame=32,signed=Num("effect_signed"),source=Mem(7,Addr("animation_source"),160),oam=Mem(44,0,160)});runs.Add(new{tag=run.GetProperty("tag").GetString(),frames=Num("animation_video_frames",2),common=Mem(7,Addr("animation_state"),109),script=Mem(7,Addr("action_script"),29)});
 }
 if(!c.GetProperty("smoke").GetBoolean())for(int i=0;Num("native_done")==0;i++){if(i>10000)throw new Exception("Audio completion timeout");Step();Observe();}
 var auditLog=new StringBuilder(1000000);Audit.GetScriptLog(audit,auditLog,1000000);File.WriteAllText(Text("output")+".audit.log",auditLog.ToString());
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),home=Text("home"),audio,pictures,runs},new JsonSerializerOptions{WriteIndented=true}));
 }catch{File.WriteAllText(Text("output")+".failure.json",JsonSerializer.Serialize(new{audio,pictures,runs,pixels=Mem(7,0xd200,128),palettes=Mem(7,0xd870,128),keys=Mem(7,0xd2a0,160)}));throw;}
 finally{Core.Stop();Core.Release();}}
}
