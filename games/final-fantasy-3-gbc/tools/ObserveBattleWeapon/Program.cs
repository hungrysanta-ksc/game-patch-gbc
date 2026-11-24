using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.Loader;
using System.Security.Cryptography;
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
 [DllImport("MesenCore.dll")] static extern void LoadStateFile([MarshalAs(UnmanagedType.LPUTF8Str)] string path);
 [DllImport("MesenCore.dll")] static extern void TakeScreenshot();
 [DllImport("MesenCore.dll")] static extern int LoadScript([MarshalAs(UnmanagedType.LPUTF8Str)] string name,[MarshalAs(UnmanagedType.LPUTF8Str)] string path,[MarshalAs(UnmanagedType.LPUTF8Str)] string content,int id);
 [DllImport("MesenCore.dll")] static extern void GetScriptLog(int id,System.Text.StringBuilder output,uint size);

 static void Wait(Func<bool> f,string reason){var s=Stopwatch.StartNew();while(!f()){if(s.ElapsedMilliseconds>10000)throw new Exception("Timeout: "+reason);Thread.Sleep(1);}}
 static void Frame(byte cpu,int count=1){var before=Native.GetTimingInfo(cpu).clock;Native.Step(cpu,count,6);Wait(()=>Native.GetTimingInfo(cpu).clock>before&&Native.IsExecutionStopped()&&Native.IsPaused(),"frame step");}
 static object MakeStruct(Type type){var v=Activator.CreateInstance(type)!;foreach(var f in type.GetFields()){if(f.IsStatic)continue;var m=f.GetCustomAttribute<MarshalAsAttribute>();if(f.FieldType.IsArray&&m?.SizeConst>0){var t=f.FieldType.GetElementType()!;var a=Array.CreateInstance(t,m.SizeConst);if(t.IsValueType&&!t.IsPrimitive&&!t.IsEnum)for(int i=0;i<a.Length;i++)a.SetValue(MakeStruct(t),i);f.SetValue(v,a);}else if(f.FieldType.IsValueType&&!f.FieldType.IsPrimitive&&!f.FieldType.IsEnum)f.SetValue(v,MakeStruct(f.FieldType));}return v;}
 static void ConfigureNes(string dll){var dir=Path.GetDirectoryName(dll)!;AssemblyLoadContext.Default.Resolving+=(context,name)=>{var p=Path.Combine(dir,name.Name+".dll");return File.Exists(p)?context.LoadFromAssemblyPath(p):null;};var assembly=AssemblyLoadContext.Default.LoadFromAssemblyPath(Path.Combine(dir,"Mesen.dll"));NativeLibrary.SetDllImportResolver(assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(dll):IntPtr.Zero);var type=assembly.GetType("Mesen.Config.InteropNesConfig",true)!;var config=MakeStruct(type);var defaults=Activator.CreateInstance(assembly.GetType("Mesen.Config.NesConfig",true)!)!;var palette=(uint[])defaults.GetType().GetProperty("UserPalette")!.GetValue(defaults)!;Array.Copy(palette,(uint[])type.GetField("UserPalette")!.GetValue(config)!,palette.Length);foreach(var f in type.GetFields())if(f.Name.EndsWith("Volume"))f.SetValue(config,100u);type.GetField("SpritesEnabled")!.SetValue(config,true);type.GetField("BackgroundEnabled")!.SetValue(config,true);type.GetField("InputScanline")!.SetValue(config,241);assembly.GetType("Mesen.Interop.ConfigApi",true)!.GetMethod("SetNesConfig")!.Invoke(null,new[]{config});}
 static void Main(string[] args){
 using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;string Text(string k)=>c.GetProperty(k).GetString()!;
 void Verify(string key,string expected){if(Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(Text(key)))).ToLowerInvariant()!=expected)throw new Exception("Unsupported "+key);}
 Verify("rom","262a98737975df25fff80ad91090c3da039d2828035c6253140d2c5f3b176ea2");
 Verify("dll","1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994");
 Verify("state","55faa0141c1ad2218c458e957bae27c514d94feaffde86003a2fde7fad0a61c9");
 if(Directory.Exists(Path.Combine(Text("home"),"Screenshots"))||File.Exists(Path.Combine(Text("home"),"trace.log")))throw new Exception("Use a fresh capture directory");
 foreach(var p in c.GetProperty("patches").EnumerateArray()){uint a=p.GetProperty("address").GetUInt32();if(!(a<0x800||(a>=0x6000&&a<0x8000)))throw new Exception("Patch outside RAM");}
 NativeLibrary.SetDllImportResolver(typeof(Native).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);
 try{Directory.CreateDirectory(Text("home"));Native.InitDll();Native.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,false,true);ConfigureNes(Text("dll"));Native.SetEmulationConfig(new Native.Speed{speed=0,turbo=0,rewind=100});
 if(!Native.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("Load ROM");Native.InitializeDebugger();Native.Pause();Wait(()=>Native.IsExecutionStopped()&&Native.IsPaused(),"pause");LoadStateFile(Text("state"));Wait(()=>Native.IsExecutionStopped()&&Native.IsPaused(),"state");
 foreach(var p in c.GetProperty("patches").EnumerateArray())Native.SetMemoryValue(8,p.GetProperty("address").GetUInt32(),p.GetProperty("value").GetByte());
 var scriptPath=Text("audit");int id=LoadScript("duration-audit",scriptPath,File.ReadAllText(scriptPath),-1);if(id<0)throw new Exception("Load audit");
 var log=new System.Text.StringBuilder(1000000);var frames=new List<object>();var start=Native.GetTimingInfo(8);Native.WaveRecord(Text("home")+"/original.wav");int ended=-1;
 for(int frame=0;frame<300;frame++){Frame(8);TakeScreenshot();var t=Native.GetTimingInfo(8);frames.Add(new{frame,ppuFrame=t.frame,clock=t.clock});log.Clear();GetScriptLog(id,log,1000000);if(log.ToString().Contains("duration:end,")&&ended<0)ended=frame;if(ended>=0&&frame>=ended+3)break;}
 Native.WaveStop();File.WriteAllText(Text("home")+"/trace.log",log.ToString());File.WriteAllText(Text("home")+"/capture.json",JsonSerializer.Serialize(new{startFrame=start.frame,fps=start.fps,frames,ended},new JsonSerializerOptions{WriteIndented=true}));if(ended<0)throw new Exception("Missing animation return");Console.WriteLine(JsonSerializer.Serialize(new{frames=frames.Count,ended,fps=start.fps}));
 }finally{Native.WaveStop();Native.Stop();Native.Release();}
 }
}
