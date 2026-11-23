using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Diagnostics;
static class Audit {
 // Pinned core ABI: four 123-word key maps, turbo speed, controller type.
 [StructLayout(LayoutKind.Sequential)]public struct Controller {[MarshalAs(UnmanagedType.ByValArray,SizeConst=492)]public ushort[] Keys;public uint Turbo,Type;}
 [StructLayout(LayoutKind.Sequential)]public struct GameboyConfig {
  public Controller Main,Linked;public uint Model;public byte Sgb2,Link;public uint LinkVideo,LinkAudio;
  public byte Blend,AdjustColors,DisableBackground,DisableSprites,HideBorder;public uint Ram;public byte InvalidInput;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=4)]public uint[] Background;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=4)]public uint[] Object0;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=4)]public uint[] Object1;
  public uint Pulse1,Pulse2,Noise,Wave;
 }
 [DllImport("MesenCore.dll")]public static extern void SetGameboyConfig(GameboyConfig config);
 public static void ConfigureVideo(){
  if(Marshal.SizeOf<GameboyConfig>()!=2080||Marshal.OffsetOf<GameboyConfig>(nameof(GameboyConfig.Blend)).ToInt32()!=2000)throw new Exception("Pinned GameboyConfig ABI");
  SetGameboyConfig(new GameboyConfig{Main=new Controller{Keys=new ushort[492]},Linked=new Controller{Keys=new ushort[492]},Model=1,Sgb2=1,Blend=0,AdjustColors=1,Background=new uint[]{0xffffff,0xb0b0b0,0x686868,0},Object0=new uint[]{0xffffff,0xb0b0b0,0x686868,0},Object1=new uint[]{0xffffff,0xb0b0b0,0x686868,0},Pulse1=100,Pulse2=100,Noise=100,Wave=100});
 }
 [DllImport("MesenCore.dll")]public static extern int LoadScript([MarshalAs(UnmanagedType.LPUTF8Str)]string name,[MarshalAs(UnmanagedType.LPUTF8Str)]string path,[MarshalAs(UnmanagedType.LPUTF8Str)]string content,int id);
 [DllImport("MesenCore.dll")]public static extern void GetScriptLog(int id,StringBuilder output,uint size);
 [StructLayout(LayoutKind.Sequential,Pack=1)]public struct Buttons {public byte A,B,X,Y,L,R,U,D,Up,Down,Left,Right,Select,Start;}
 [DllImport("MesenCore.dll")]public static extern void SetInputOverrides(uint index,Buttons state);
 [DllImport("MesenCore.dll")]public static extern void TakeScreenshot();
}
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 byte Read(string k)=>Core.GetMemoryValue(7,Addr(k));uint Num(string k,int n){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(i*8);return v;}
 void Put(string k,uint v,int n=1){for(int i=0;i<n;i++)Core.SetMemoryValue(7,Addr(k)+(uint)i,(byte)(v>>(i*8)));}
 string Mem(int type,uint a,int n){var b=new byte[n];Core.GetMemoryValues(type,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 string Bytes(string k,int n)=>Mem(7,Addr(k),n);
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 var frames=new List<object>();var pages=new List<object>();var jobs=c.GetProperty("jobs");int pending=-1,next=0,release=0,releasedAt=-1,finish=-1,loads=0,script=-1;bool done=false;uint requestFrame=0,completeFrame=0;ulong requestClock=0,completeClock=0;
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;i<500&&Read("text_ready")!=0xa5;i++)Step(1);if(Read("text_ready")!=0xa5)throw new Exception("Boot ready missing");
 script=Audit.LoadScript("text-audio-audit",Text("auditPath"),Text("audit"),-1);if(script<0)throw new Exception("Audit script load");
 Put("native_request",255); // Same automatic schedule, repeatable origin for both runs.
 for(int frame=0;frame<c.GetProperty("frameBudget").GetInt32();frame++){
  Step(1);if(release>0&&(Read("text_request")!=0||Num("text_loads",2)==loads+1)){release=0;Audit.SetInputOverrides(0,new Audit.Buttons());releasedAt=frame;}
  for(int g=0;Read("native_irq_busy")!=0;g++){if(g>20000)throw new Exception("Audio producer never yields");Step(17,0);}
  var snapshot=new byte[232];uint at=Addr("native_snapshot")+Read("native_published")*232u;Core.GetMemoryValues(7,at,at+231,snapshot); if(frame%600==0)Console.WriteLine("frame="+frame+" ticks="+Num("native_ticks",4)+" pages="+pages.Count+" late="+Num("native_max_late",2)+" underruns="+Num("native_underruns",2)); var timing=Core.GetTimingInfo(7);bool ended=Read("native_done")!=0;
  frames.Add(new{frame=timing.frame,masterClock=timing.clock,masterRate=timing.rate,timer=Num("native_clock",2),ticks=BitConverter.ToUInt32(snapshot,216),events=BitConverter.ToUInt32(snapshot,220),state=Convert.ToHexString(snapshot,0,216).ToLowerInvariant(),sourceHash=BitConverter.ToUInt16(snapshot,224),gbHash=BitConverter.ToUInt16(snapshot,226),consumed=Bytes("native_consumed",12),maxLate=Num("native_max_late",2),underruns=Num("native_underruns",2),done=ended,error=Read("ff3_error"),platformError=Read("platform_error"),probeFailures=Read("platform_probe_failures"),probeCases=Num("platform_probe_cases",2),guard=Mem(7,0xd7f0,16),cellGuard=Mem(7,0xd940,16),stackGuard=Mem(7,0xdb60,16),svbk=Core.GetMemoryValue(7,0xff70),bank=Core.GetMemoryValue(7,Addr("_current_bank")),lcdc=Core.GetMemoryValue(7,0xff40),key1=Core.GetMemoryValue(7,0xff4d),hardware=Mem(7,0xff10,20),transferBusy=Read("text_transfer_busy"),transferFault=Read("text_transfer_fault"),transferChunks=Num("text_transfer_chunks",2),transferBytes=Num("text_transfer_bytes",2),transferFrames=Num("text_transfer_frames",2),maxTransferFrames=Num("text_transfer_max_frames",2),maxLy=Read("text_transfer_max_ly")});
  if(pending>=0&&Read("text_request")==0&&Num("text_loads",2)==loads+1){if(finish<0){finish=frame;completeFrame=timing.frame;completeClock=timing.clock;}if(frame>=finish+3){bool screenshot=next<jobs.GetArrayLength();if(screenshot)Audit.TakeScreenshot();pages.Add(new{responseFrames=completeFrame-requestFrame,responseSeconds=(completeClock-requestClock)/(double)timing.rate,audioDone=ended,job=pending,ordinal=next,frame=timing.frame,visible=Read("text_visible"),more=Read("text_more"),page=Read("text_page"),error=Read("text_error"),npcError=Read("npc_error"),viewError=Read("text_view_error"),cache=Read("text_cache_count"),cells=Bytes("text_cells",320),state=Bytes("ff3_game_state",1024),names=Bytes("dialogue_name_state",48),oam=Mem(44,0,160),vram=screenshot?Mem(43,0,16384):"",screenshot});pending=-1;next++;}}
  if(ended&&pending<0){done=true;break;}
  if(Read("ff3_error")!=0||Read("text_view_error")!=0||Read("text_transfer_fault")!=0)throw new Exception("Runtime fault");
  // Hold until the game's input loop acknowledges the press; wait for its
  // observed release before another edge. Three-frame pulses could be missed
  // while the cooperative producer ran, stalling the test despite an idle UI.
  if(!ended&&pending<0&&release==0&&frame>releasedAt&&Read("text_polled_keys")==0&&jobs.GetArrayLength()>0){requestFrame=timing.frame;requestClock=timing.clock;pending=next%jobs.GetArrayLength();finish=-1;loads=(int)Num("text_loads",2);var r=jobs[pending].GetProperty("request");
   if(r.TryGetProperty("flags",out var flags)){int j=0;foreach(var v in flags.EnumerateArray())Core.SetMemoryValue(7,Addr("ff3_game_state")+0x20+(uint)j++,v.GetByte());}
   if(r.TryGetProperty("key",out var key)){var b=new Audit.Buttons();if(key.GetString()!="A")throw new Exception("Unexpected key");b.A=1;Audit.SetInputOverrides(0,b);release=3;}
   else{if(r.TryGetProperty("id",out var id))Put("text_selection",id.GetUInt32(),2);if(r.TryGetProperty("item",out var item))Core.SetMemoryValue(7,Addr("text_context")+4,item.GetByte());Put("text_request",r.GetProperty("command").GetUInt32());}
  }
 }
 if(!done)throw new Exception("Run did not finish");
 }finally{if(script>=0){var log=new StringBuilder(1000000);Audit.GetScriptLog(script,log,1000000);File.WriteAllText(Text("output")+".lua.log",log.ToString());}File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),done,frames,pages}));Core.Stop();Core.Release();}
 }
}
