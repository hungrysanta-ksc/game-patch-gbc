using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
static class Shot {[DllImport("MesenCore.dll")]public static extern void TakeScreenshot();}
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Map debugger timeout");Thread.Sleep(1);}}
 static void Step(int n,int kind=0){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();byte Read(string k)=>Core.GetMemoryValue(7,Addr(k));
 void Write(string k,byte v)=>Core.SetMemoryValue(7,Addr(k),v);
 string Memory(int type,uint address,int n){var b=new byte[n];Core.GetMemoryValues(type,address,address+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 string Bytes(string k,int n)=>Memory(7,Addr(k),n);
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("Map ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;i<500&&(Read("map_ready")!=0xa5||Read("map_request")!=0);i++)Step(100000);if(Read("map_ready")!=0xa5)throw new Exception("Map ready missing");
 var observations=new List<object>();
 foreach(var request in c.GetProperty("requests").EnumerateArray()){
  foreach(var key in new[]{"world","id","x","y"})Write("map_"+key,request.GetProperty(key).GetByte());Write("map_request",1);
  int steps=0;while(Read("map_request")!=0){if(++steps>500)throw new Exception("Map load budget");Step(100000);}
  if(Read("map_error")==0)Step(3,6);
  if(request.GetProperty("screenshot").GetBoolean()&&Read("map_error")==0)Shot.TakeScreenshot();
  observations.Add(new{world=Read("map_world"),id=Read("map_id"),x=Read("map_x"),y=Read("map_y"),error=Read("map_error"),assetError=Read("asset_error"),negative=Read("map_negative"),bank=Core.GetMemoryValue(7,Addr("_current_bank")),loads=Bytes("map_loads",2),tiles=Memory(7,0xd000,1024),properties=Memory(7,0xd787,16),collision=Memory(7,0xd687,256),guard=Memory(7,0xd7f0,16),svbk=Core.GetMemoryValue(7,0xff70),gfx=Memory(43,0x800,4096),map=Memory(43,0x1800,1024),attributes=Memory(43,0x3800,1024),palettes=Memory(45,0,32),lcdc=Core.GetMemoryValue(7,0xff40),vbk=Core.GetMemoryValue(7,0xff4f),scx=Core.GetMemoryValue(7,0xff43),scy=Core.GetMemoryValue(7,0xff42)});
 }
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),recording=false,observations}));Console.WriteLine("Map observations: "+observations.Count);
 }finally{Core.Stop();Core.Release();}}
}
