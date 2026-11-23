using System.Runtime.InteropServices;
using System.Text.Json;
using System.Diagnostics;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("State debugger timeout");Thread.Sleep(1);}}
 static void Step(int n){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,6);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;
 uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 byte Read(string k)=>Core.GetMemoryValue(7,Addr(k));
 uint Number(string k,int n){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(8*i);return v;}
 void Write(string k,byte v)=>Core.SetMemoryValue(7,Addr(k),v);
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);
 Directory.CreateDirectory(Text("home"));
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});if(!Core.LoadRom(Text("rom"),IntPtr.Zero))throw new Exception("Load failed");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
 for(int i=0;i<300&&Read("state_ready")!=0xa5;i++)Step(1);if(Read("state_ready")!=0xa5)throw new Exception("State ready missing");
 Write("state_start",c.GetProperty("resume").GetBoolean()?(byte)2:(byte)1);
 for(int i=0;i<200000&&Read("state_status")==0;i+=500)Step(500);
 var observations=new List<object>();
 foreach(var cmd in c.GetProperty("commands").EnumerateArray()){
  var bytes=Convert.FromHexString(cmd.GetProperty("input").GetString()!);if(bytes.Length!=1024)throw new Exception("State input length");
  for(uint i=0;i<bytes.Length;i++)Core.SetMemoryValue(7,Addr("state_buffer")+i,bytes[i]);
  Write("state_slot",cmd.GetProperty("slot").GetByte());uint offset=cmd.GetProperty("offset").GetUInt32();Write("state_offset",(byte)offset);Core.SetMemoryValue(7,Addr("state_offset")+1,(byte)(offset>>8));Write("state_command",cmd.GetProperty("op").GetByte());
  for(int i=0;i<600&&Read("state_command")!=0;i++)Step(1);if(Read("state_command")!=0)throw new Exception("State command timeout");
  var actual=new byte[1024];Core.GetMemoryValues(7,Addr("state_buffer"),Addr("state_buffer")+1023,actual);
  observations.Add(new{result=Read("state_result"),state=Convert.ToHexString(actual).ToLowerInvariant(),disabledRam=Core.GetMemoryValue(7,0xa000),failure=Read("state_failure")});
 }
 File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),status=Read("state_status"),failure=Read("state_failure"),testCase=Number("state_case",4),index=Number("state_index",2),observations},new JsonSerializerOptions{WriteIndented=true}));
 Console.WriteLine("STATE status="+Read("state_status")+" failure="+Read("state_failure")+" case="+Number("state_case",4));
 }finally{Core.Stop();Core.Release();}}
}
