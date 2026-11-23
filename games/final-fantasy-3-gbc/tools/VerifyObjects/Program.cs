using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
static class Shot {[DllImport("MesenCore.dll")]public static extern void TakeScreenshot();}
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Object debugger timeout");Thread.Sleep(1);}}
 static void Step(int n,int kind=0){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();byte Read(string k)=>Core.GetMemoryValue(7,Addr(k));
 void Write(string k,byte v)=>Core.SetMemoryValue(7,Addr(k),v);
 string Memory(int type,uint address,int n){var b=new byte[n];Core.GetMemoryValues(type,address,address+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 string Bytes(string k,int n)=>Memory(7,Addr(k),n);
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("Object ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;i<500&&(Read("object_ready")!=0xa5||Read("object_request")!=0);i++)Step(500000);if(Read("object_ready")!=0xa5||Read("object_request")!=0)throw new Exception("Object ready missing");
 var observations=new List<object>();
 foreach(var request in c.GetProperty("requests").EnumerateArray()){
  foreach(var key in new[]{"world","map","x","y","phase","flags","bad_list"})Write("object_"+key,request.GetProperty(key).GetByte());Write("object_request",1);
  int steps=0;while(Read("object_request")!=0){if(++steps>100)throw new Exception("Object load budget");Step(500000);}
  if((Core.GetMemoryValue(7,0xff40)&128)!=0)Step(3,6);
  if(request.GetProperty("screenshot").GetBoolean())Shot.TakeScreenshot();
  observations.Add(new{world=Read("object_world"),mapId=Read("object_map"),x=Read("object_x"),y=Read("object_y"),phase=Read("object_phase"),flags=Read("object_flags"),error=Read("object_error"),assetError=Read("asset_error"),bank=Core.GetMemoryValue(7,Addr("_current_bank")),loads=Bytes("object_loads",2),count=Read("object_count"),entries=Read("object_oam_count"),peak=Read("object_line_peak"),part1=Bytes("object_part1",192),part2=Bytes("object_part2",192),state=Bytes("object_game_state",1024),guard=Memory(7,0xd7f0,16),svbk=Core.GetMemoryValue(7,0xff70),gfx=Memory(43,0x2000,3072),background=Memory(43,0x800,4096),map=Memory(43,0x1800,1024),attributes=Memory(43,0x3800,1024),palettes=Memory(45,0,32)+Memory(46,0,16),oam=Memory(44,0,160),lcdc=Core.GetMemoryValue(7,0xff40),vbk=Core.GetMemoryValue(7,0xff4f)});
  if(observations.Count%128==0)File.WriteAllText(Text("output")+".progress",observations.Count.ToString());
 }
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),recording=false,observations}));Console.WriteLine("Object observations: "+observations.Count);
 }finally{Core.Stop();Core.Release();}}
}
