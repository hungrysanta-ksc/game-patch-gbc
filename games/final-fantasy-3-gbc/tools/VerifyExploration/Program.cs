using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Diagnostics;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
  string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
  byte Read(string k)=>Core.GetMemoryValue(7,Addr(k));uint Num(string k,int n){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(i*8);return v;}
  void Put(string k,uint v,int n=1){for(int i=0;i<n;i++)Core.SetMemoryValue(7,Addr(k)+(uint)i,(byte)(v>>(i*8)));}
  byte F(uint n)=>Core.GetMemoryValue(7,Addr("field")+n);void SetF(uint n,byte v)=>Core.SetMemoryValue(7,Addr("field")+n,v);
  string Mem(int type,uint a,int n){var b=new byte[n];Core.GetMemoryValues(type,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
  string Bytes(string k,int n)=>Mem(7,Addr(k),n);
 object MemoryResult(){uint floor=0xdcb0,untouched=0;while(floor+untouched<0xe000&&Core.GetMemoryValue(39,floor+untouched-0xc000)==0x5a)untouched++;return new{stackFloor=floor,stackBytes=0xe000-floor,untouchedBytes=untouched,watermarkUsedBytes=0xe000-floor-untouched,fault=Read("memory_fault"),probeDone=Read("memory_probe_done"),probeFailures=Num("memory_probe_failures",2),probeCases=Num("memory_probe_cases",2)};}

  void Write(string k,string hex){var b=Convert.FromHexString(hex);for(int i=0;i<b.Length;i++)Core.SetMemoryValue(7,Addr(k)+(uint)i,b[i]);}
  void Assert(bool p,string message){if(!p)throw new Exception(message+" field="+Bytes("field",56));}
  NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
  var frames=new List<object>();var shots=new List<object>();int script=-1,units=0,total=0;bool done=false;
  var npcRecords=new SortedDictionary<int,string>();
  var eventRecords=new SortedDictionary<int,string>();
  void CollectNpc(){if(script<0)return;var log=new StringBuilder(2000000);Audit.GetScriptLog(script,log,2000000);
   foreach(var line in log.ToString().Split('\n'))if(line.StartsWith("npc-step:")){string clean=line.TrimEnd('\r');int id=int.Parse(clean.Split(':')[1]);if(npcRecords.TryGetValue(id,out var old))Assert(old==clean,"NPC observation identity");else npcRecords.Add(id,clean);}
   foreach(var line in log.ToString().Split('\n'))if(line.StartsWith("event-step:")){string clean=line.TrimEnd('\r');int id=int.Parse(clean.Split(':')[1]);if(eventRecords.TryGetValue(id,out var old))Assert(old==clean,"Event observation identity");else eventRecords.Add(id,clean);}
  }
  try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});Assert(Core.LoadRom(Text("rom"),IntPtr.Zero),"ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
   if(c.TryGetProperty("sceneLayout",out var combined)&&combined.GetBoolean()){for(int i=0;Read("state_ready")!=0xa5;i++){Assert(i<600,"Combined boot gate");Step(1);}Put("state_start",2);}
   for(int i=0;i<600&&F(26)!=0xa5;i++)Step(1);Assert(F(26)==0xa5,"Boot ready");
   if(c.TryGetProperty("memoryProbe",out var probe)&&probe.GetBoolean()){
    SetF(27,1);Step(4);script=Audit.LoadScript("memory-audit",Text("auditPath"),Text("audit"),-1);Assert(script>=0,"Memory audit");
    string state=Bytes("ff3_game_state",1024),map=Mem(39,0x1000,0x7f0),objects=Bytes("object_part1",192)+Bytes("object_part2",192);
    Put("memory_probe_request",1);for(int i=0;Read("memory_probe_done")!=0xa5;i++){Assert(i<1500,"Memory probe timeout");Step(1);}
    Assert(Num("memory_probe_failures",2)==0&&Num("memory_probe_cases",2)==2167,"Memory cases");
    Assert(Bytes("ff3_game_state",1024)==state&&Mem(39,0x1000,0x7f0)==map&&Bytes("object_part1",192)+Bytes("object_part2",192)==objects,"Protected original state");
    Assert(Num("native_underruns",2)==0&&Num("native_max_late",2)==0,"Probe audio continuity");
    done=true;return;
   }else if(c.TryGetProperty("fixtures",out var fixtures)){
    SetF(27,1);
    foreach(var job in fixtures.EnumerateArray()){
     Write("field",job.GetProperty("field").GetString()!);Write("object_part1",job.GetProperty("part1").GetString()!);Write("object_part2",job.GetProperty("part2").GetString()!);
     if(job.TryGetProperty("event",out var ev)){Write("npc_execution",ev.GetProperty("execution").GetString()!);Put("npc_pc",ev.GetProperty("pc").GetUInt32(),2);Put("npc_active",ev.GetProperty("active").GetByte());}else Put("npc_active",0);
     var motion=job.TryGetProperty("motion",out var m)?Convert.FromHexString(m.GetString()!):new byte[7];SetF(73,motion[0]);SetF(74,motion[0]);SetF(32,motion[0]);SetF(33,motion[1]);for(uint j=0;j<5;j++)SetF(67+j,motion[j+2]);
     if(job.TryGetProperty("mapProperty",out var prop)){for(uint j=0;j<1024;j++)Core.SetMemoryValue(7,0xd000+j,1);for(uint j=0;j<256;j++)Core.SetMemoryValue(7,0xd687+j,0);Core.SetMemoryValue(7,0xd687,0x24);Core.SetMemoryValue(7,0xd689,prop.GetByte());Core.SetMemoryValue(7,0xd78a,job.GetProperty("fill").GetByte());}
     SetF(20,job.GetProperty("op").GetByte());
     // A stopped CPU may be inside a storage-bank copy. Restore bank 1
     // before testing the request or reading/writing the next field fixture.
     for(int i=0;(Core.GetMemoryValue(7,0xff70)&7)!=1||F(20)!=0||F(47)!=0||F(65)!=0;i++){Assert(i<1000,"Fixture timeout "+units);Step(1000,0);}
     var e=job.GetProperty("expected");foreach(var name in new[]{"field","part1","part2"}){string key=name=="field"?name:"object_"+name;Assert(Bytes(key,name=="field"?28:192)==e.GetProperty(name).GetString(),"6502 comparison "+units+" op="+job.GetProperty("op")+" "+name+" expected="+e.GetProperty(name).GetString());}
     if(e.TryGetProperty("motion",out var expectedMotion))Assert(Mem(7,Addr("field")+32,2)+Mem(7,Addr("field")+67,5)==expectedMotion.GetString(),"NPC scheduler state "+units);
     if(e.TryGetProperty("oam",out var expectedOam))Assert(Mem(44,0,160)==expectedOam.GetString(),"Original player animation OAM "+units);
     if(e.TryGetProperty("event",out var ee))Assert(Bytes("npc_execution",5)==ee.GetProperty("execution").GetString()&&Num("npc_pc",2)==ee.GetProperty("pc").GetUInt32()&&Read("npc_active")==ee.GetProperty("active").GetByte(),"Original event execution "+units+" actual="+Bytes("npc_execution",5)+" pc="+Num("npc_pc",2)+" expected="+ee);
     units++;if(units%500==0)Console.WriteLine("units="+units);
    }
    done=true;
   }else{
    script=Audit.LoadScript("exploration-audit",Text("auditPath"),Text("audit"),-1);Assert(script>=0,"Audit script");Put("native_request",255);
    void Frame(){Step(1);total++;for(int g=0;Read("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;g++){Assert(g<20000,"IRQ never yields");Step(17,0);}
     Assert(Read("memory_fault")==0,"Memory fault");
     Assert(F(16)==0&&F(39)==0&&Read("asset_error")==0&&Read("text_error")==0&&Read("npc_error")==0&&Read("ff3_error")==0&&Read("text_transfer_fault")==0,"Runtime fault");
     Assert(Num("native_underruns",2)==0&&Num("native_max_late",2)==0,"Audio timing late="+Num("native_max_late",2)+" underruns="+Num("native_underruns",2));
     foreach(uint a in new uint[]{0xd7f0,0xd940,0xdb60,0xdca0})Assert(Mem(7,a,16)==new string('a',0)+string.Concat(Enumerable.Repeat("a7",16)),"Memory guard "+a);
     var timing=Core.GetTimingInfo(7);frames.Add(new{frame=timing.frame,clock=timing.clock,rate=timing.rate,timer=Num("native_clock",2),consumed=Bytes("native_consumed",12),done=Read("native_done"),late=Num("native_max_late",2),underruns=Num("native_underruns",2),field=Bytes("field",75),scroll=Mem(7,0xff42,2),hardware=Mem(7,0xff10,20)});
     if(total%600==0)Console.WriteLine("frame="+total+" ticks="+Num("native_ticks",4)+" mode="+F(19));
     if(total%4==0)CollectNpc();
    }
    void Until(Func<bool> f,string name,int limit=400){for(int i=0;!f();i++){Assert(i<limit,"Timeout "+name);Frame();}}
    void Run(int n){for(int i=0;i<n;i++)Frame();}
    void Keys(string k){Audit.SetInputOverrides(0,new Audit.Buttons{A=(byte)(k.Contains('A')?1:0),B=(byte)(k.Contains('B')?1:0),Up=(byte)(k.Contains('U')?1:0),Down=(byte)(k.Contains('D')?1:0),Left=(byte)(k.Contains('L')?1:0),Right=(byte)(k.Contains('R')?1:0)});}
    void Release(){Keys("");Until(()=>F(36)==0,"release");Run(3);}
    // Controlled pixel checkpoint, separate from normal-play timing evidence.
    // Pause only at a completed loop; never write positions, NPC state or RNG.
    void Shot(string label){SetF(27,1);Until(()=>F(64)==0&&F(72)==0&&F(47)==0&&F(65)==0,"checkpoint idle");Run(2);
     SetF(20,6);Until(()=>F(20)==0&&F(47)==0&&F(65)==0,"checkpoint publish");Run(2);
     Audit.TakeScreenshot();shots.Add(new{label,controlledCheckpoint=true,field=Bytes("field",75),part1=Bytes("object_part1",192),part2=Bytes("object_part2",192),oam=Mem(44,0,160),vram=Mem(43,0,16384),palette=Mem(45,0,128),state=Bytes("ff3_game_state",1024),cells=Bytes("text_cells",320),visible=Read("text_visible"),more=Read("text_more"),textId=Num("npc_text_id",2),scroll=Mem(7,0xff42,2),frame=Core.GetTimingInfo(7).frame});
     uint due=(Num("native_clock",2)+68)&65535;SetF(50,(byte)due);SetF(51,(byte)(due>>8));SetF(27,0);
    }
    // ff3_field_pixel clears speed before storing the new tile coordinate.
    // A frame boundary can stop between these instructions; wait for both
    // stores instead of treating that transient as a completed wrong step.
    void Walk(string key,int x,int y){Keys(key);Until(()=>Math.Abs((((F(0)+7)&63)*16+F(2))-x*16)+Math.Abs((((F(1)+7)&63)*16+F(3))-y*16)<=12,"approach "+key+" to "+x+","+y);Release();Until(()=>F(5)==0&&((F(0)+7)&63)==x&&((F(1)+7)&63)==y,"finish step at "+x+","+y);Assert(((F(0)+7)&63)==x&&((F(1)+7)&63)==y,"Walk endpoint");}
    if(c.TryGetProperty("eventRoute",out var eventRoute)&&eventRoute.GetBoolean()){
     Run(5);Shot("event-entry");
     for(int cycle=0;cycle<2;cycle++){
      Keys("A");Until(()=>Read("text_visible")!=0,"original event first dialogue");Release();Assert(Num("npc_text_id",2)==546,"Selected event 118 first text");Shot("event-first-"+cycle);
      Keys("A");Until(()=>Read("text_visible")==0,"close first dialogue");Release();
      Until(()=>Read("text_visible")!=0,"source NPC movement and wait",1400);Assert(Num("npc_text_id",2)==547,"Original event second text");Shot("event-second-"+cycle);
      for(int pages=0;Read("text_visible")!=0;pages++){Assert(pages<20,"Event page limit");byte page=Read("text_page");Keys("A");Until(()=>Read("text_visible")==0||Read("text_page")!=page,"event page advance");Release();}
      Until(()=>F(19)==0,"source event termination");Assert(Read("npc_active")==0,"Event ends");Shot("event-return-"+cycle);
     }
     while(Read("native_done")==0){Frame();Assert(total<8500,"Event audio schedule timeout");}
     done=true;return;
    }
    Run(5);Shot("entry");Keys("A");Until(()=>F(36)==16,"distant A sampled");Run(6);Release();Assert(F(19)==0&&Read("text_visible")==0,"Distant talk rejected");
    Walk("U",10,7);Keys("U");Run(25);Release();Assert(F(5)==0&&((F(1)+7)&63)==7&&F(38)>0,"NPC blocks movement");Shot("front-npc");
    if(c.TryGetProperty("profileOnly",out var profile)&&profile.GetBoolean()){done=true;return;}
    for(int cycle=0;cycle<3;cycle++){
     Keys("A");Until(()=>F(19)==2&&Read("text_visible")!=0,"front talk");Release();Shot("dialogue-"+cycle);
     string position=Bytes("field",7),npcs=Bytes("object_part1",192);byte beforeFrame=F(73);Keys("D");Run(20);Assert((byte)(F(73)-beforeFrame)>=15&&(byte)(F(73)-beforeFrame)<=25,"Dialogue frame clock advances");Assert(Bytes("field",7)==position&&Bytes("object_part1",192)==npcs,"Dialogue freezes player and NPC movement");Release();
     for(int pages=0;F(19)==2;pages++){Assert(pages<20,"Dialogue page limit");byte before=Read("text_page");Keys(cycle==1?"B":"A");Until(()=>F(19)==0||Read("text_page")!=before||Read("text_visible")==0,"acknowledge");Release();}
     Until(()=>F(19)==0,"event end after dialogue");Assert(Read("text_visible")==0&&Read("npc_active")==0,"Return to exploration");Shot("return-"+cycle);
     Walk("D",10,10);Walk("R",11,10);Walk("L",10,10);Shot("walked-back-"+cycle);Walk("U",10,7);
    }
    // Repeated actual button movement while the full original music/SFX/fade
    // schedule runs. No direct position or dialogue request writes here.
    while(Read("native_done")==0){Walk("D",10,10);Walk("U",10,7);if(total>8500)throw new Exception("Audio schedule timeout");}
    done=true;Shot("completed");
   }
  }finally{if(script>=0){CollectNpc();File.WriteAllLines(Text("output")+".npc.log",npcRecords.Values);File.WriteAllLines(Text("output")+".event.log",eventRecords.Values);var log=new StringBuilder(8000000);Audit.GetScriptLog(script,log,8000000);File.WriteAllText(Text("output")+".lua.log",log.ToString());}File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),coreSha256=Text("coreSha256"),done,units,frames,shots,memory=MemoryResult()}));Core.Stop();Core.Release();}
 }
}
