using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
static class Input {
 [StructLayout(LayoutKind.Sequential,Pack=1)] public struct Buttons {public byte A,B,X,Y,L,R,U,D,Up,Down,Left,Right,Select,Start;}
 [DllImport("MesenCore.dll")]public static extern void SetInputOverrides(uint index,Buttons state);
 [DllImport("MesenCore.dll")]public static extern void TakeScreenshot();
}
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Text debugger timeout");Thread.Sleep(1);}}
 static void Step(int n,int kind=0){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();byte Read(string k)=>Core.GetMemoryValue(7,Addr(k));
 void Write(string k,byte v)=>Core.SetMemoryValue(7,Addr(k),v);
 string Memory(int type,uint address,int n){var b=new byte[n];Core.GetMemoryValues(type,address,address+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 string Bytes(string k,int n)=>Memory(7,Addr(k),n);
 void Complete(){for(int i=0;Read("text_request")!=0;i++){if(i>100)throw new Exception("Text command budget");Step(500000);}Step(3,6);}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("Text ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;i<500&&(Read("text_ready")!=0xa5||Read("text_request")!=0);i++)Step(500000);if(Read("text_ready")!=0xa5||Read("text_request")!=0)throw new Exception("Text ready missing");
 var observations=new List<object>();
 foreach(var request in c.GetProperty("requests").EnumerateArray()){
  void SetWord(string name,uint value,int bytes){for(int j=0;j<bytes;j++)Core.SetMemoryValue(7,Addr(name)+(uint)j,(byte)(value>>(j*8)));}
  if(request.TryGetProperty("flags",out var flags)){int j=0;foreach(var v in flags.EnumerateArray())Core.SetMemoryValue(7,Addr("text_game_state")+0x20+(uint)j++,v.GetByte());}
  if(request.TryGetProperty("names",out var names)){int j=0;foreach(var v in names.EnumerateArray()){ushort n=v.GetUInt16();Core.SetMemoryValue(7,Addr("dialogue_name_state")+(uint)j++,(byte)n);Core.SetMemoryValue(7,Addr("dialogue_name_state")+(uint)j++,(byte)(n>>8));}}
  if(request.TryGetProperty("shown",out var shown))Core.SetMemoryValue(7,Addr("text_game_state")+14,shown.GetByte());
  if(request.TryGetProperty("gil",out var gil))for(int j=0;j<3;j++)Core.SetMemoryValue(7,Addr("text_game_state")+0x1c+(uint)j,(byte)(gil.GetUInt32()>>(j*8)));
  if(request.TryGetProperty("variable",out var variable))for(int j=0;j<3;j++)Core.SetMemoryValue(7,Addr("text_context")+5+(uint)j,(byte)(variable.GetUInt32()>>(j*8)));
  if(request.TryGetProperty("item",out var item))Core.SetMemoryValue(7,Addr("text_context")+4,item.GetByte());
  if(request.TryGetProperty("flag",out var flag))Write("dialogue_flag",flag.GetByte()); if(request.TryGetProperty("set",out var set))Write("dialogue_set",set.GetByte()); if(request.TryGetProperty("npc",out var npc))Write("dialogue_npc",npc.GetByte());
  if(request.TryGetProperty("world",out var world))Write("dialogue_world",world.GetByte());
  if(request.TryGetProperty("value",out var value))SetWord("number_value",value.GetUInt32(),4);
  if(request.TryGetProperty("digits",out var digits))Write("number_digits",digits.GetByte());
  if(request.TryGetProperty("key",out var key)){
   var b=new Input.Buttons();switch(key.GetString()){case "A":b.A=1;break;case "B":b.B=1;break;case "Right":b.Right=1;break;case "Start":b.Start=1;break;case "Select":b.Select=1;break;case "Left":b.Left=1;break;default:throw new Exception("Unknown input");}
   Input.SetInputOverrides(0,b);Step(5,6);Complete();Input.SetInputOverrides(0,new Input.Buttons());Step(3,6);
  }else{ushort id=request.TryGetProperty("id",out var selected)?selected.GetUInt16():(ushort)0;Write("text_selection",(byte)id);Core.SetMemoryValue(7,Addr("text_selection")+1,(byte)(id>>8));Write("text_request",request.GetProperty("command").GetByte());Complete();}
  if(request.GetProperty("screenshot").GetBoolean())Input.TakeScreenshot();
  observations.Add(new{transferFault=Read("text_transfer_fault"),transferMaxLy=Read("text_transfer_max_ly"),transferMaxFrames=Bytes("text_transfer_max_frames",2),npcError=Read("npc_error"),npcEvent=Read("npc_event"),npcActive=Read("npc_active"),npcText=Bytes("npc_text_id",2),npcPc=Bytes("npc_pc",2),dialogue=Bytes("npc_dialogue",32),number=Bytes("number_output",14),names=Bytes("dialogue_name_state",48),error=Read("text_error"),viewError=Read("text_view_error"),assetError=Read("asset_error"),visible=Read("text_visible"),more=Read("text_more"),page=Read("text_page"),offset=Bytes("text_offset",2),selection=Bytes("text_selection",2),loads=Bytes("text_loads",2),cacheCount=Read("text_cache_count"),cells=Bytes("text_cells",320),cache=Bytes("text_cache",256),bank=Core.GetMemoryValue(7,Addr("_current_bank")),guard=Memory(7,0xd7f0,16),svbk=Core.GetMemoryValue(7,0xff70),vram=request.GetProperty("screenshot").GetBoolean()?Memory(43,0,16384):"",palettes=Memory(45,0,64),oam=Memory(44,0,160),state=Bytes("text_game_state",1024),lcdc=Core.GetMemoryValue(7,0xff40),vbk=Core.GetMemoryValue(7,0xff4f),wx=Core.GetMemoryValue(7,0xff4b),wy=Core.GetMemoryValue(7,0xff4a)});
 }
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),observations}));Console.WriteLine("Text observations: "+observations.Count);
 }finally{Core.Stop();Core.Release();}}
}
