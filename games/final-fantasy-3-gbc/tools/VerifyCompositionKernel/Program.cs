using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Diagnostics;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n=1,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 uint Num(string k,int n=1){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(i*8);return v;}
 void Put(string k,uint v,int n=1){for(int i=0;i<n;i++)Core.SetMemoryValue(7,Addr(k)+(uint)i,(byte)(v>>(i*8)));}
 string Mem(int type,uint a,int n){var b=new byte[n];Core.GetMemoryValues(type,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 var frames=new List<object>();var cells=new List<object>();int script=-1;bool done=false;int count=c.GetProperty("jobCount").GetInt32(),next=0,pending=-1;ulong requested=0;
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;Num("kernel_ready")!=0xa5;i++){if(i>500)throw new Exception("Boot timeout");Step();}
 for(int g=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;g++){if(g>20000)throw new Exception("Boot IRQ never yields");Step(17,0);}
 script=Audit.LoadScript("composition-kernel-audit",Text("auditPath"),Text("audit"),-1);if(script<0)throw new Exception("Audit load");Put("native_request",255);
 for(int frame=0;frame<c.GetProperty("frameBudget").GetInt32();frame++){
  Step();for(int g=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;g++){if(g>20000)throw new Exception("IRQ never yields");Step(17,0);}
  var timing=Core.GetTimingInfo(7);bool ended=Num("native_done")!=0;if(frame%600==0)Console.WriteLine("frame="+frame+" cells="+cells.Count+" underruns="+Num("native_underruns",2));
  frames.Add(new{frame,timer=Num("native_clock",2),consumed=Mem(7,Addr("native_consumed"),12),maxLate=Num("native_max_late",2),underruns=Num("native_underruns",2),done=ended,error=Num("ff3_error"),platformError=Num("platform_error"),memoryFault=Num("memory_fault"),transferFault=Num("text_transfer_fault"),guard=Mem(7,0xd7f0,16)+Mem(7,0xd94d,3)+Mem(7,0xdb60,16),svbk=Core.GetMemoryValue(7,0xff70),key1=Core.GetMemoryValue(7,0xff4d),lcdc=Core.GetMemoryValue(7,0xff40),master=timing.clock,rate=timing.rate});
  if(pending>=0&&Num("kernel_request")==0){cells.Add(new{id=pending,error=Num("kernel_error"),ticks=Num("kernel_ticks",2),output=Mem(7,Addr("text_staging"),48),vram=Mem(43,0,48),seconds=(timing.clock-requested)/(double)timing.rate,audioDone=ended});pending=-1;next++;}
  // Drain the already requested cell after audio ends; do not leave its
  // measured compute/upload outside the observation count.
  if(ended&&pending<0){done=true;break;}
  if(!ended&&pending<0&&count>0){pending=next%count;Put("kernel_job",(uint)pending,2);requested=timing.clock;Put("kernel_request",1);}
 }
 }finally{if(script>=0){var log=new StringBuilder(1000000);Audit.GetScriptLog(script,log,1000000);File.WriteAllText(Text("output")+".lua.log",log.ToString());}uint untouched=0;while(untouched<0x490&&Core.GetMemoryValue(39,0x1b70+untouched)==0x5a)untouched++;File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),done,frames,cells,stackUntouchedBytes=untouched}));Core.Stop();Core.Release();}
 if(!done)throw new Exception("Audio schedule incomplete");
 }
}
