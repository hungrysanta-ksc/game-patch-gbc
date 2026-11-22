using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.Loader;
static class Native {
 const string D="MesenCore.dll";
 [DllImport(D)] public static extern void InitDll();
 [DllImport(D)] public static extern void InitializeEmu([MarshalAs(UnmanagedType.LPUTF8Str)]string home,IntPtr w,IntPtr v,[MarshalAs(UnmanagedType.I1)]bool software,[MarshalAs(UnmanagedType.I1)]bool noAudio,[MarshalAs(UnmanagedType.I1)]bool noVideo,[MarshalAs(UnmanagedType.I1)]bool noInput);
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
 [DllImport(D)]public static extern void WaveRecord([MarshalAs(UnmanagedType.LPUTF8Str)]string path);
 [DllImport(D)]public static extern void WaveStop();
 [DllImport(D)]public static extern void Stop();
 [DllImport(D)]public static extern void Release();
 [DllImport(D)]public static extern void SetEmulationConfig(Speed config);
 [StructLayout(LayoutKind.Sequential)]public struct Speed {public uint speed,turbo,rewind,runahead;}
 [StructLayout(LayoutKind.Sequential)]public struct Timing{public double fps;public ulong clock;public uint rate,frame,lines;public int first;public uint cycles;}
}
class Program {
 static void Wait(Func<bool> f,string reason){var s=Stopwatch.StartNew();while(!f()){if(s.ElapsedMilliseconds>10000)throw new Exception("Timeout: "+reason);Thread.Sleep(1);}}
 static void Frame(byte cpu,int count=1){var before=Native.GetTimingInfo(cpu).clock;Native.Step(cpu,count,6);Wait(()=>Native.GetTimingInfo(cpu).clock>before&&Native.IsExecutionStopped()&&Native.IsPaused(),"frame step");}
 static object MakeStruct(Type type){var v=Activator.CreateInstance(type)!;foreach(var f in type.GetFields()){if(f.IsStatic)continue;var m=f.GetCustomAttribute<MarshalAsAttribute>();if(f.FieldType.IsArray&&m?.SizeConst>0){var t=f.FieldType.GetElementType()!;var a=Array.CreateInstance(t,m.SizeConst);if(t.IsValueType&&!t.IsPrimitive&&!t.IsEnum)for(int i=0;i<a.Length;i++)a.SetValue(MakeStruct(t),i);f.SetValue(v,a);}else if(f.FieldType.IsValueType&&!f.FieldType.IsPrimitive&&!f.FieldType.IsEnum)f.SetValue(v,MakeStruct(f.FieldType));}return v;}
 static void ConfigureNes(string dll){var dir=Path.GetDirectoryName(dll)!;AssemblyLoadContext.Default.Resolving+=(context,name)=>{var p=Path.Combine(dir,name.Name+".dll");return File.Exists(p)?context.LoadFromAssemblyPath(p):null;};var assembly=AssemblyLoadContext.Default.LoadFromAssemblyPath(Path.Combine(dir,"Mesen.dll"));NativeLibrary.SetDllImportResolver(assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(dll):IntPtr.Zero);var type=assembly.GetType("Mesen.Config.InteropNesConfig",true)!;var config=MakeStruct(type);foreach(var f in type.GetFields())if(f.Name.EndsWith("Volume"))f.SetValue(config,100u);type.GetField("SpritesEnabled")!.SetValue(config,true);type.GetField("BackgroundEnabled")!.SetValue(config,true);type.GetField("InputScanline")!.SetValue(config,241);assembly.GetType("Mesen.Interop.ConfigApi",true)!.GetMethod("SetNesConfig")!.Invoke(null,new[]{config});}
 static void Main(string[] args){
  using var d=JsonDocument.Parse(File.ReadAllText(args[0]));var c=d.RootElement;string Get(string k)=>c.GetProperty(k).GetString()!;int Num(string k)=>c.GetProperty(k).GetInt32();
  NativeLibrary.SetDllImportResolver(typeof(Native).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Get("dll")):IntPtr.Zero);
  byte cpu=(byte)Num("cpu");int memory=cpu==8?8:7;uint ready=(uint)Num("ready"),request=(uint)Num("request"),counter=(uint)Num("counter");
  Directory.CreateDirectory(Get("home"));Directory.CreateDirectory(Path.GetDirectoryName(Get("wav"))!);
  try{Native.InitDll();Native.InitializeEmu(Get("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);if(cpu==8)ConfigureNes(Get("dll"));Native.SetEmulationConfig(new Native.Speed{speed=0,turbo=0,rewind=100});
   if(!Native.LoadRom(Get("rom"),IntPtr.Zero))throw new Exception("LoadRom failed");Native.InitializeDebugger();Native.Pause();Wait(()=>Native.IsExecutionStopped()&&Native.IsPaused(),"initial pause");
   for(int i=0;i<300&&Native.GetMemoryValue(memory,ready)!=0xa5;i++)Frame(cpu);
   if(Native.GetMemoryValue(memory,ready)!=0xa5)throw new Exception("ROM ready marker missing");
   Native.WaveRecord(Get("wav"));Native.SetMemoryValue(memory,request,(byte)Num("selection"));var frames=new List<object>();var clock=Native.GetTimingInfo(cpu);int last=-1;
   for(int i=0;i<Num("frames")+300;i++){
    Frame(cpu);
    {for(int guard=0;Native.GetMemoryValue(memory,(uint)Num("busy"))!=0;guard++){if(guard>10000)throw new Exception("Busy update did not complete");var before=Native.GetTimingInfo(cpu).clock;Native.Step(cpu,cpu==7?456:341,4);Wait(()=>Native.GetTimingInfo(cpu).clock>before&&Native.IsExecutionStopped()&&Native.IsPaused(),"finish atomic audio update");}}
    int tick=Native.GetMemoryValue(memory,counter)|(Native.GetMemoryValue(memory,counter+1)<<8);
    if(tick!=last){var state=new byte[cpu==8?192:12];uint at=cpu==8?0x7f40u:(uint)Num("packet");Native.GetMemoryValues(memory,at,at+(uint)state.Length-1,state);frames.Add(new{tick,frame=Native.GetTimingInfo(cpu).frame,hex=Convert.ToHexString(state).ToLowerInvariant()});last=tick;}
    if(tick>=Num("frames"))break;if(i==Num("frames")+299)throw new Exception("Playback stalled");
   }
   Native.WaveStop();var end=Native.GetTimingInfo(cpu);File.WriteAllText(Get("wav")+".json",JsonSerializer.Serialize(new{cpu,rom=Get("rom"),firstFrame=clock.frame,endFrame=end.frame,fps=clock.fps,sourceTicks=last,frames},new JsonSerializerOptions{WriteIndented=true}));Console.WriteLine(JsonSerializer.Serialize(new{wav=Get("wav"),ticks=last,frames=end.frame-clock.frame}));
  }finally{Native.WaveStop();Native.Stop();Native.Release();}
 }
}
