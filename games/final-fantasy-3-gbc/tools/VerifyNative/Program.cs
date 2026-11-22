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
 static void Wait(Func<bool> f){var timer=Stopwatch.StartNew();while(!f()){if(timer.ElapsedMilliseconds>30000)throw new Exception("Debugger step timed out");Thread.Sleep(1);}}
 static void Step(int count,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,count,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;string Text(string k)=>c.GetProperty(k).GetString()!;uint Address(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();byte Read(string k)=>Core.GetMemoryValue(7,Address(k));uint Number(string k,int n){uint value=0;for(int i=0;i<n;i++)value|=(uint)Core.GetMemoryValue(7,Address(k)+(uint)i)<<(i*8);return value;}string Bytes(string k,int n){var b=new byte[n];Core.GetMemoryValues(7,Address(k),Address(k)+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));Directory.CreateDirectory(Path.GetDirectoryName(Text("output"))!);
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load failed");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());string mode=Text("mode"),ready=mode=="engine"?"engine_ready":"native_ready";for(int i=0;i<300&&Read(ready)!=0xa5;i++)Step(1);if(Read(ready)!=0xa5)throw new Exception("Ready missing");
 var observations=new List<object>();bool complete=false;
 if(mode=="engine"){for(int i=0;i<40000;i+=500){if(Read("engine_status")!=0){complete=true;break;}Step(500);}observations.Add(new{frame=Core.GetTimingInfo(7).frame,status=Read("engine_status"),failure=Read("engine_failure"),testCase=Number("engine_case",2),index=Number("engine_index",2)});}
 else {Core.SetMemoryValue(7,Address("native_request"),255);for(int i=0;i<4200;i+=30){Step(30);for(int guard=0;Read("native_irq_busy")!=0;guard++){if(guard>10000)throw new Exception("Update never completed: busy="+Read("native_busy")+" irq="+Read("native_irq_busy")+" ticks="+Number("native_ticks",4)+" error="+Read("ff3_error"));Step(17,0);}var snapshot=new byte[232];uint snapshotAddress=Address("native_snapshot")+Read("native_published")*232u;Core.GetMemoryValues(7,snapshotAddress,snapshotAddress+231,snapshot);var timing=Core.GetTimingInfo(7);observations.Add(new{frame=timing.frame,masterClock=timing.clock,masterRate=timing.rate,timer=Number("native_clock",2),ticks=BitConverter.ToUInt32(snapshot,216),events=BitConverter.ToUInt32(snapshot,220),sourceHash=BitConverter.ToUInt16(snapshot,224),gbHash=BitConverter.ToUInt16(snapshot,226),state=Convert.ToHexString(snapshot,0,216).ToLowerInvariant(),consumed=Bytes("native_consumed",12),maxLate=Number("native_max_late",2),underruns=Number("native_underruns",2),pops=BitConverter.ToUInt16(snapshot,228),done=Read("native_done")!=0,error=Read("ff3_error"),key1=Core.GetMemoryValue(7,0xff4d),nr52=Core.GetMemoryValue(7,0xff26),nr12=Core.GetMemoryValue(7,0xff12),nr22=Core.GetMemoryValue(7,0xff17),nr32=Core.GetMemoryValue(7,0xff1c),nr42=Core.GetMemoryValue(7,0xff21),nr43=Core.GetMemoryValue(7,0xff22)});if(Read("native_done")!=0||Read("ff3_error")!=0){complete=true;break;}}}
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),recording=false,complete,observations},new JsonSerializerOptions{WriteIndented=true}));if(!complete)throw new Exception("Execution budget exhausted");Console.WriteLine(Text("output"));
 }finally{Core.Stop();Core.Release();}}
}
