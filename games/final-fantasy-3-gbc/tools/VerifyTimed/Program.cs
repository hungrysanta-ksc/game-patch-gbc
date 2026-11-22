// State-only execution verifier. No recording entry points or microphone access.
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
static class Core {
 const string D="MesenCore.dll";
 [DllImport(D)]public static extern void InitDll();
 [DllImport(D)]public static extern void InitializeEmu([MarshalAs(UnmanagedType.LPUTF8Str)]string home,IntPtr w,IntPtr v,[MarshalAs(UnmanagedType.I1)]bool software,[MarshalAs(UnmanagedType.I1)]bool noAudio,[MarshalAs(UnmanagedType.I1)]bool noVideo,[MarshalAs(UnmanagedType.I1)]bool noInput);
 [DllImport(D)][return:MarshalAs(UnmanagedType.I1)]public static extern bool LoadRom([MarshalAs(UnmanagedType.LPUTF8Str)]string path,IntPtr patch);
 [DllImport(D)]public static extern void InitializeDebugger();
 [DllImport(D)]public static extern void Pause();
 [DllImport(D)][return:MarshalAs(UnmanagedType.I1)]public static extern bool IsExecutionStopped();
 [DllImport(D)][return:MarshalAs(UnmanagedType.I1)]public static extern bool IsPaused();
 [DllImport(D)]public static extern void Step(byte cpu,int count,int kind);
 [DllImport(D)]public static extern Timing GetTimingInfo(byte cpu);
 [DllImport(D)]public static extern byte GetMemoryValue(int type,uint address);
 [DllImport(D)]public static extern void SetMemoryValue(int type,uint address,byte value);
 [DllImport(D)]public static extern void GetMemoryValues(int type,uint start,uint end,[Out]byte[] data);
 [DllImport(D)]public static extern void Stop();
 [DllImport(D)]public static extern void Release();
 [DllImport(D)]public static extern void SetEmulationConfig(Speed config);
 [StructLayout(LayoutKind.Sequential)]public struct Speed{public uint speed,turbo,rewind,runahead;}
 [StructLayout(LayoutKind.Sequential)]public struct Timing{public double fps;public ulong clock;public uint rate,frame,lines;public int first;public uint cycles;}
}
class Program {
 static void Wait(Func<bool> f){var s=Stopwatch.StartNew();while(!f()){if(s.ElapsedMilliseconds>15000)throw new Exception("Debugger step timed out");Thread.Sleep(1);}}
 static void Step(int count,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,count,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){
  using var document=JsonDocument.Parse(File.ReadAllText(args[0]));var c=document.RootElement;string Text(string k)=>c.GetProperty(k).GetString()!;uint Address(string k)=>c.GetProperty("symbols").GetProperty("timed_"+k).GetUInt32();
  byte Read(string k)=>Core.GetMemoryValue(7,Address(k));uint Number(string k,int size){uint value=0;for(int i=0;i<size;i++)value|=(uint)Core.GetMemoryValue(7,Address(k)+(uint)i)<<(i*8);return value;}
  NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);
  Directory.CreateDirectory(Text("home"));Directory.CreateDirectory(Path.GetDirectoryName(Text("output"))!);
  try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load failed");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
   for(int i=0;i<300&&Read("ready")!=0xa5;i++)Step(1);if(Read("ready")!=0xa5)throw new Exception("Ready marker missing");
   Core.SetMemoryValue(7,Address("request"),(byte)c.GetProperty("selection").GetInt32());var observations=new List<object>();bool finished=false;int frames=c.GetProperty("maxFrames").GetInt32(),goal=c.GetProperty("loopGoal").GetInt32();
   for(int i=0;i<frames;i+=60){Step(60);for(int guard=0;Read("busy")!=0||Read("irq_busy")!=0;guard++){if(guard>10000)throw new Exception("Audio update not completing");Step(4096,4);}
    if(Read("error")!=0)throw new Exception("Player rejected an overflowing output packet");
    var regs=new byte[24];Core.GetMemoryValues(7,Address("regs"),Address("regs")+23,regs);var consumed=new byte[12];Core.GetMemoryValues(7,Address("consumed"),Address("consumed")+11,consumed);var timing=Core.GetTimingInfo(7);uint loops=BitConverter.ToUInt16(consumed,10);bool done=Read("done")!=0;
    observations.Add(new{frame=timing.frame,masterClock=timing.clock,masterRate=timing.rate,timer=Number("clock",2),records=Number("records",4),writes=Number("writes",4),hash=Number("hash",2),preparedLoops=Number("loops",2),loops,done,deadline=Number("deadline",2),maxLate=Number("max_late",2),underruns=Number("underruns",2),pops=Number("pops",2),popMinTicks=Number("pop_min_ticks",1),popWidthError=Number("pop_width_error",1),popLate=Number("pop_late",1),key1=Core.GetMemoryValue(7,0xff4d),nr52=Core.GetMemoryValue(7,0xff26),regs=Convert.ToHexString(regs).ToLowerInvariant(),consumed=Convert.ToHexString(consumed).ToLowerInvariant()});
    if(goal>0?loops>=goal:done){finished=true;break;}
   }
   if(!finished&&goal>=0)throw new Exception("Track did not reach requested loop/end");File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),recording=false,selection=c.GetProperty("selection").GetInt32(),loopGoal=goal,maxFrames=frames,observations},new JsonSerializerOptions{WriteIndented=true}));Console.WriteLine(Text("output"));
  }finally{Core.Stop();Core.Release();}
 }
}
