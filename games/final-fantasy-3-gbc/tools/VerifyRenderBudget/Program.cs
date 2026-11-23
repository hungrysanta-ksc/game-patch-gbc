using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
static class Shot {[DllImport("MesenCore.dll")]public static extern void TakeScreenshot();}
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Render budget debugger timeout");Thread.Sleep(1);}}
 static void Step(){var before=Core.GetTimingInfo(7).clock;Core.Step(7,1,6);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();byte Read(string k)=>Core.GetMemoryValue(7,Addr(k));
 string Memory(int type,uint address,int n){var b=new byte[n];Core.GetMemoryValues(type,address,address+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;Read("render_ready")!=0xa5;i++){if(i>300)throw new Exception("Boot timeout");Step();}
 var observations=new List<object>();foreach(byte page in new byte[]{0,1,0}){
 Core.SetMemoryValue(7,Addr("render_page"),page);Core.SetMemoryValue(7,Addr("render_request"),1);for(int i=0;Read("render_request")!=0;i++){if(i>300)throw new Exception("Scene load timeout");Step();}for(int i=0;i<4;i++)Step();Shot.TakeScreenshot();
 observations.Add(new{page,oam=Memory(44,0,160),graphics=Memory(43,8192,2048),lcdc=Core.GetMemoryValue(7,0xff40),svbk=Core.GetMemoryValue(7,0xff70),vbk=Core.GetMemoryValue(7,0xff4f),bgPalette=Memory(45,0,32),objPalette=Memory(46,0,16)});
 }File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),observations}));
 }finally{Core.Stop();Core.Release();}}
}
