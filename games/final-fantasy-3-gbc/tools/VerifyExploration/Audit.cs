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
