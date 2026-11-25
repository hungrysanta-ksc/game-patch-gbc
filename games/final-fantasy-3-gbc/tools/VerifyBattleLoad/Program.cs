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
 string Mem(int type,uint at,int n){var b=new byte[n];Core.GetMemoryValues(type,at,at+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 void Yield(){for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){if(i>20000)throw new Exception("IRQ never yields");Step(17,0);}}
 var audio=new List<object>();
 void Observe(){Yield();var t=Core.GetTimingInfo(7);uint fault=Num("ff3_error")+Num("party_error")+Num("memory_fault")+Num("text_transfer_fault")+Num("platform_error")+Num("native_underruns",2)+Num("native_max_late",2);audio.Add(new{consumed=Mem(7,Addr("native_consumed"),12),timer=Num("native_clock",2),master=t.clock,rate=t.rate,fault});if(fault!=0||Mem(7,0xddf0,16)!=string.Concat(Enumerable.Repeat("a7",16)))throw new Exception("Load/audio fault "+fault);}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;Num("party_ready")!=0xa5;i++){if(i>500)throw new Exception("Boot timeout");Step();}Observe();
 uint phase=c.GetProperty("phase").GetUInt32();if(Num("native_consumed",4)>=phase)throw new Exception("Missed fixed source tick");
 int audit=Audit.LoadScript("battle-load",Text("scriptPath"),Text("script"),-1);if(audit<0)throw new Exception("Load audit");
 for(int i=0;Num("native_consumed",4)<phase;i++){if(i>500)throw new Exception("Phase timeout");Step();Observe();}
 for(int i=0;Num("party_request")!=0;i++){if(i>500)throw new Exception("Load timeout");Step();Observe();}
 Step(2);Observe();Audit.TakeScreenshot();
 var picture=new{profile=Num("party_profile"),frame=Num("party_frame"),visible=Num("party_visible"),source=Mem(7,Addr("party_source"),96),state=Mem(7,Addr("party_motion"),35),oam=Mem(44,0,160),bgPalette=Mem(45,0,32),objPalette=Mem(46,0,64),guard=Mem(7,0xd4c0,16),terrainGuard=Mem(7,0xd5a0,16),stoneGuard=Mem(7,0xd900,16)};
 // Keep the ready frame visible. This probe covers a fixed original-audio
 // phase and 120 subsequent ticks, not the full battle/audio schedule.
 uint stop=Num("native_consumed",4)+120;
 for(int i=0;Num("native_consumed",4)<stop;i++){if(i>500)throw new Exception("Audio continuation timeout");Step();Observe();}
 var log=new StringBuilder(1000000);Audit.GetScriptLog(audit,log,1000000);File.WriteAllText(Text("output")+".lua.log",log.ToString());
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),phase,home=Text("home"),audio,picture}));
 }finally{Core.Stop();Core.Release();}}
}
