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
 string Oam(){var b=new byte[96];Core.GetMemoryValues(44,0,95,b);return Convert.ToHexString(b).ToLowerInvariant();}
 void Yield(){for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){if(i>20000)throw new Exception("IRQ never yields");Step(17,0);}}
 var audio=new List<object>();var pictures=new List<object>();
 void Observe(){Yield();var t=Core.GetTimingInfo(7);audio.Add(new{consumed=Mem(Addr("native_consumed"),12),timer=Num("native_clock",2),master=t.clock,rate=t.rate,done=Num("native_done"),late=Num("native_max_late",2),underruns=Num("native_underruns",2),error=Num("ff3_error"),videoError=Num("party_error"),memoryFault=Num("memory_fault"),transferFault=Num("text_transfer_fault"),platformError=Num("platform_error"),guard=Mem(0xddf0,16),svbk=Core.GetMemoryValue(7,0xff70)});if(Num("ff3_error")+Num("party_error")+Num("memory_fault")+Num("text_transfer_fault")+Num("native_underruns",2)+Num("native_max_late",2)!=0)throw new Exception("Party/audio runtime fault");}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;Num("party_ready")!=0xa5;i++){if(i>500)throw new Exception("Boot timeout");Step();}Observe();
 var counts=c.GetProperty("counts").EnumerateArray().Select(x=>x.GetInt32()).ToArray();
 for(int p=0;p<counts.Length;p++){
  Put("party_profile",(byte)p);Put("party_request",1);
  for(int i=0;Num("party_request")!=0;i++){if(i>500)throw new Exception("Load timeout");Step();Observe();}
  for(int f=0;f<counts[p];f++){
   if(f>0){Put("party_step",1);for(int i=0;Num("party_step")!=0;i++){if(i>100)throw new Exception("Advance timeout");Step();Observe();}}
   Step(2);Observe();Audit.TakeScreenshot();pictures.Add(new{profile=p,frame=f,visible=Num("party_visible"),source=Mem(Addr("party_source"),96),oam=Oam(),state=Mem(Addr("party_motion"),35)});
  }
 }
 // Same artifact and loaded assets, then uninterrupted repeated live entry
 // motion across the remaining original music/SFX/fade schedule.
 var script=Audit.LoadScript("party-residency",Text("auditPath"),Text("audit"),-1);if(script<0)throw new Exception("Audit load");Put("party_pause",0);
 for(int i=0;Num("native_done")==0;i++){if(i>8500)throw new Exception("Audio schedule timeout");Step();Observe();if(i%600==0)File.AppendAllText(Text("output")+".progress.log",i+Environment.NewLine);}
 var log=new StringBuilder(3000000);Audit.GetScriptLog(script,log,3000000);File.WriteAllText(Text("output")+".lua.log",log.ToString());
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),home=Text("home"),audio,pictures,serial=Num("party_serial",2),prepared=Num("party_prepared",2),maxPrepareTicks=Num("party_max_prepare",2),missed=Num("party_missed",2),maxGapFrames=Num("party_max_gap",2),done=Num("native_done")},new JsonSerializerOptions{WriteIndented=true}));
 }finally{Core.Stop();Core.Release();}}
}
