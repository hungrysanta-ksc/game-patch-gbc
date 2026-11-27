using System.Runtime.InteropServices;using System.Text;using System.Text.Json;using System.Diagnostics;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n=1,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 bool live=c.TryGetProperty("liveParty",out var liveOption)&&liveOption.GetBoolean();
 bool encounterMode=c.TryGetProperty("encounterMode",out var encounterOption)&&encounterOption.GetBoolean();
 int cycleCount=c.GetProperty("cases").GetArrayLength();
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 uint Num(string k,int n=1){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(i*8);return v;}
 void Put(string k,uint v,int n=1){for(int i=0;i<n;i++)Core.SetMemoryValue(7,Addr(k)+(uint)i,(byte)(v>>(i*8)));}
 byte F(uint n)=>Core.GetMemoryValue(7,Addr("field")+n);void SetF(uint n,byte v)=>Core.SetMemoryValue(7,Addr("field")+n,v);
 string Mem(int type,uint a,int n){var b=new byte[n];Core.GetMemoryValues(type,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 string Bytes(string k,int n)=>Mem(7,Addr(k),n);
 void Write(string k,string hex){var b=Convert.FromHexString(hex);for(uint i=0;i<b.Length;i++)Core.SetMemoryValue(7,Addr(k)+i,b[i]);}
 void Assert(bool p,string message){if(!p)throw new Exception(message+" phase="+Num("scene_phase")+" sceneFault="+Num("scene_fault")+" field="+Bytes("field",40));}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);Directory.CreateDirectory(Text("home"));
 var encounters=new List<object>();var actions=new List<object>();var audio=new List<object>();var shots=new List<object>();var pictures=new List<object>();var cycles=new List<object>();var requests=new List<object>();var phases=new List<object>();var rejections=new List<object>();uint external=0,lastTicks=0,lastPhase=0,permittedPartyError=0;int script=-1,total=0;bool done=false,encounterPending=false;object? encounter=null;
 void Frame(){Step();total++;for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){Assert(i<20000,"IRQ yield");Step(17,0);}
  Assert(Num("scene_fault")+Num("scene_arena_fault")+Num("memory_fault")+Num("text_transfer_fault")+Num("ff3_error")==0,"Shared runtime fault");
  Assert(Num("native_underruns",2)+Num("native_max_late",2)==0,"Audio continuity late="+Num("native_max_late",2)+" under="+Num("native_underruns",2));
  Assert(Num("scene_audio_boots")==1,"Audio initialized only once");
  if(Num("scene_phase")==1)Assert((F(16)==0||((encounterPending||encounterMode)&&F(16)==4))&&F(39)+Num("asset_error")+Num("npc_error")+Num("text_error")==0,"Field runtime");
  if(Num("scene_phase")==3)Assert(Num("party_error")==0||Num("party_error")==permittedPartyError,"Battle runtime");
  uint ticks=Num("native_consumed",4);Assert(ticks>=lastTicks,"Audio was restarted");lastTicks=ticks;
  uint serial=Num("native_external_serial",2);if(serial!=external){Assert(serial==external+1,"Lost source sound request");external=serial;requests.Add(new{tick=Num("native_external_tick",2),op=Num("native_external_op"),arg=Num("native_external_arg")});}
  var t=Core.GetTimingInfo(7);if(Num("scene_phase")!=lastPhase){lastPhase=Num("scene_phase");phases.Add(new{phase=lastPhase,master=t.clock,rate=t.rate});}
  audio.Add(new{master=t.clock,rate=t.rate,timer=Num("native_clock",2),consumed=Bytes("native_consumed",12),phase=Num("scene_phase"),owner=Num("scene_video_owner"),cycles=Num("scene_cycles"),lcdc=Core.GetMemoryValue(7,0xff40)});
  if(total%600==0)Console.WriteLine("frame="+total+" ticks="+ticks+" phase="+Num("scene_phase"));
 }
 void Until(Func<bool> f,string why,int limit=600){for(int i=0;!f();i++){Assert(i<limit,"Timeout "+why);Frame();}}
 void Run(int n){for(int i=0;i<n;i++)Frame();}
 void Keys(string k){Audit.SetInputOverrides(0,new Audit.Buttons{A=(byte)(k.Contains('A')?1:0),B=(byte)(k.Contains('B')?1:0),Up=(byte)(k.Contains('U')?1:0),Down=(byte)(k.Contains('D')?1:0),Left=(byte)(k.Contains('L')?1:0),Right=(byte)(k.Contains('R')?1:0)});}
 void Release(){Keys("");Until(()=>F(36)==0,"release");Run(3);}
 void Walk(string key,int x,int y){Keys(key);Until(()=>Math.Abs((((F(0)+7)&63)*16+F(2))-x*16)+Math.Abs((((F(1)+7)&63)*16+F(3))-y*16)<=12,"approach "+key);Release();Until(()=>F(5)==0&&((F(0)+7)&63)==x&&((F(1)+7)&63)==y,"completed tile step");}
 void PauseField(){SetF(27,1);Until(()=>F(64)==0&&F(72)==0&&F(47)==0&&F(65)==0,"field idle");Run(2);}
 void ResumeField(){uint due=(Num("native_clock",2)+68)&65535;SetF(50,(byte)due);SetF(51,(byte)(due>>8));SetF(27,0);}
 void FieldShot(string label){PauseField();SetF(20,6);Until(()=>F(20)==0&&F(47)==0&&F(65)==0,"picture publish");Run(2);Audit.TakeScreenshot();shots.Add(new{label,field=Bytes("field",75),part1=Bytes("object_part1",192),part2=Bytes("object_part2",192),oam=Mem(44,0,160),vram=Mem(43,0,16384),palette=Mem(45,0,128),state=Bytes("ff3_game_state",1024),cells=Bytes("text_cells",320),visible=Num("text_visible"),textId=Num("npc_text_id",2),scroll=Mem(7,0xff42,2),frame=Core.GetTimingInfo(7).frame});}
 object BattleScreen()=>new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)};
 try{Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});Assert(Core.LoadRom(Text("rom"),IntPtr.Zero),"ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
  for(int i=0;Num("state_ready")!=0xa5;i++){Assert(i<600,"Boot gate");Step();}Put("state_start",encounterMode?6u:live?5u:4u);
  for(int i=0;Num("scene_phase")!=1;i++){Assert(i<600,"Initial field ready");Step();}
  PauseField(); // Initial song is replaced once by the bounded source test schedule.
  script=Audit.LoadScript("roundtrip-audit",Text("auditPath"),Text("audit"),-1);Assert(script>=0,"Audit load");Put("native_request",255);
  for(int i=0;Num("native_request")!=0;i++){Assert(i<50,"Audio schedule start");Step();}audio.Clear();requests.Clear();external=Num("native_external_serial",2);lastTicks=0;Frame();
  FieldShot("boot");ResumeField();Walk("U",10,7);
  for(int cycle=0;cycle<cycleCount;cycle++){
   var job=c.GetProperty("cases")[cycle];
   if(live){PauseField();var original=Bytes("ff3_game_state",1024);Write("ff3_game_state",original[..512]+job.GetProperty("party").GetString()+original[1536..]);}
   FieldShot("before-"+cycle);string position=Bytes("field",17),npcs=Bytes("object_part1",192)+Bytes("object_part2",192),map=Mem(7,0xd000,0x7f0),state=Bytes("ff3_game_state",1024);byte logicFrame=F(73);var begin=Core.GetTimingInfo(7);var dispatch=begin;
   if(live)state=state[..512]+job.GetProperty("derived").GetString()+state[1536..];
   if(encounterMode){
    byte tile=Core.GetMemoryValue(7,0xd000+8*32+10);uint collision=0xd687+(uint)tile*2;byte property=Core.GetMemoryValue(7,collision);Assert((property&0x88)==0,"Encounter fixture terrain");
    Core.SetMemoryValue(7,collision,(byte)(property|0x40));SetF(25,255);SetF(14,5);SetF(15,0);SetF(76,job.GetProperty("formationCursor").GetByte());Put("scene_rng_ready",0);
    string seed=Bytes("field",79);Keys("D");ResumeField();Until(()=>F(16)==4&&F(64)==0&&F(47)==0&&F(65)==0&&F(66)==0,"source field encounter after full tile");Keys("");
    string selected=Bytes("field",79);Assert(F(77)==job.GetProperty("formation").GetByte(),"Source selected formation");
    Put("scene_request",1);Run(3);Assert(Num("scene_phase")==1&&Num("scene_request")==1&&Bytes("field",79)==selected,"No fixed-profile fallback or implicit RNG seed");Put("scene_request",0);
    Core.SetMemoryValue(7,collision,property);SetF(25,0);PauseField();position=Bytes("field",17);npcs=Bytes("object_part1",192)+Bytes("object_part2",192);map=Mem(7,0xd000,0x7f0);logicFrame=F(73);
    encounters.Add(new{cycle,seed,selected,property=(byte)(property|0x40)});Put("scene_rng_seed",job.GetProperty("seed").GetUInt32());Put("scene_rng_ready",1);dispatch=Core.GetTimingInfo(7);
   }else{Put("scene_profile",job.GetProperty("profile").GetUInt32());Put("scene_request",1);}
   Until(()=>Num("scene_phase")==3&&Num("party_request")==0&&Num("party_ready")==0xa5,"battle resource load",1000);var loaded=Core.GetTimingInfo(7);
   while(Num("status_stage")!=2){Put("party_step",1);Until(()=>Num("party_step")==0,"original entry");}Run(2);
   int frames=0;bool deferred=false;
   if(encounterMode){
    Assert(Num("party_profile")==job.GetProperty("profile").GetUInt32(),"Exact formation/count/direction resource key");
    Assert(Bytes("encounter_counts",4)==job.GetProperty("counts").GetString()&&Num("encounter_type")==job.GetProperty("type").GetUInt32()&&Num("encounter_first")==job.GetProperty("first").GetUInt32(),$"Source counts and entry rules actual={Bytes("encounter_counts",4)}/{Num("encounter_type")}/{Num("encounter_first")} expected={job.GetProperty("counts")}/{job.GetProperty("type")}/{job.GetProperty("first")}");
    Assert(Bytes("battle_rng_cursor",4)==job.GetProperty("rng").GetString(),"Shared RNG after entry consumers");
    Assert(Mem(39,0x5000,256)==job.GetProperty("records").GetString()&&Bytes("ff3_game_state",1024)==state,"Current-party source properties");
    Assert(Bytes("message_monsters",12)==job.GetProperty("monsters").GetString(),"Original message monster substitution");
    Audit.TakeScreenshot();pictures.Add(new{cycle,frame=0,owner=0,screen=BattleScreen(),party=Bytes("party_state",26),motion=Bytes("party_motion",39),status=Bytes("status_state",35)});
   }
   if(live&&!encounterMode){
    if(cycle==cycleCount-1){
     string good=Bytes("ff3_game_state",1024),records=Mem(39,0x5000,256);
     foreach(var rejection in new[]{(at:0x1c0,value:22,error:81),(at:0x1c2,value:64,error:82),(at:0x2c3,value:0x62,error:83)}){
      var bad=Convert.FromHexString(good);bad[rejection.at]=(byte)rejection.value;var hex=Convert.ToHexString(bad).ToLowerInvariant();Write("ff3_game_state",hex);Put("party_error",0);permittedPartyError=(uint)rejection.error;uint tick=Num("native_consumed",4);Put("party_request",1);
      Until(()=>Num("party_request")==0&&Num("party_error")==permittedPartyError,"explicit live-party rejection",1000);
      Assert(Num("live_party_ready")==0&&Bytes("ff3_game_state",1024)==hex&&Mem(39,0x5000,256)==records,"Whole-party validation precedes mutations");Assert(Num("native_consumed",4)>tick,"Audio through rejection");
      rejections.Add(new{error=rejection.error,statePreserved=true,recordsPreserved=true});
     }
     Write("ff3_game_state",good);Put("party_error",0);permittedPartyError=0;Put("party_request",1);Until(()=>Num("party_request")==0,"reload valid live party",1000);
     while(Num("status_stage")!=2){Put("party_step",1);Until(()=>Num("party_step")==0,"entry after rejection");}Run(2);
    }
    Assert(Num("live_party_ready")==1&&Num("live_party_error")==0,"Live party entry");
    Assert(Mem(39,0x5000,256)==job.GetProperty("records").GetString(),"Original battle properties");
    Assert(Bytes("ff3_game_state",1024)==state,"Original equipment derived stats");
    Audit.TakeScreenshot();pictures.Add(new{cycle,frame=0,owner=0,screen=BattleScreen(),party=Bytes("party_state",26),motion=Bytes("party_motion",39),status=Bytes("status_state",35)});
    Put("scene_request",2);
   }else{
   Write("animation_state",job.GetProperty("animation").GetString()!);Write("action_script",job.GetProperty("script").GetString()!);Write("strike_weapons","0000");Write("hit_cover","0000");if(!encounterMode){Write("battle_rng_cursor",job.GetProperty("rng").GetString()!);Put("strike_rng_ready",1);}Put("action_probe",0);Put("animation_video_probe",1);Put("action_request",1);
   while(true){Until(()=>Num("animation_video_gate")!=0||(Num("action_request")==0&&Num("action_enabled")==0),"source magic frame",1000);Assert(Num("action_blocked")==0,"No unsupported action");if(Num("animation_video_gate")==0)break;
    Assert(++frames==Num("animation_video_frames",2),"All source frames");Run(2);Audit.TakeScreenshot();pictures.Add(new{cycle,frame=frames,owner=Num("animation_video_owner"),source=Bytes("animation_source",160),party=Bytes("party_state",26),weaponPicture=Num("strike_picture"),weapons=Bytes("strike_weapons",2),screen=BattleScreen()});
    if(frames==1&&!encounterMode){Put("scene_request",2);Run(3);Assert(Num("scene_phase")==3&&Num("scene_request")==2,"Return waits for complete action");deferred=true;}
    Put("animation_video_gate",0);
    // The queued return may run immediately after the final frame; do not
    // interpret restored field DATA as battle action variables.
    Until(()=>Num("scene_phase")!=3||Num("animation_video_gate")!=0||(Num("action_request")==0&&Num("action_enabled")==0),"next frame or action end",1000);
    if(Num("scene_phase")!=3)break;
   }
   }
   if(encounterMode){
    // Action completion can occur mid-scanout. Observe the restored frame
    // only after the PPU has presented a complete frame of that state.
    Run(2);
    Audit.TakeScreenshot();pictures.Add(new{cycle,frame=999,owner=0,screen=BattleScreen(),party=Bytes("party_state",26),motion=Bytes("party_motion",39),status=Bytes("status_state",35)});
    actions.Add(new{cycle,rng=Bytes("battle_rng_cursor",4),weapons=Bytes("strike_weapons",2),frames});Put("scene_request",2);
    var clean=Convert.FromHexString(position);clean[10]=clean[16]=0;position=Convert.ToHexString(clean).ToLowerInvariant();
   }
   Until(()=>Num("scene_phase")==1&&Num("scene_cycles")==cycle+1,"field resource restore",1000);var returned=Core.GetTimingInfo(7);
   Assert(Bytes("field",17)==position&&F(73)==logicFrame,"Player and logic clock retained");Assert(Bytes("object_part1",192)+Bytes("object_part2",192)==npcs,"NPC context retained");Assert(Mem(7,0xd000,0x7f0)==map,"Map context retained");Assert(Bytes("ff3_game_state",1024)==state,"Persistent game state retained");
   FieldShot("restored-"+cycle);cycles.Add(new{cycle,profile=job.GetProperty("profile").GetInt32(),frames,deferred,loadMs=(loaded.clock-dispatch.clock)*1000.0/dispatch.rate,encounterToLoadMs=(loaded.clock-begin.clock)*1000.0/begin.rate,roundtripMs=(returned.clock-begin.clock)*1000.0/begin.rate});ResumeField();
   // Real controller input after return: close the original selected NPC
   // event, walk away and return. No position, NPC or dialogue state writes.
   if(encounterMode)Walk("U",10,7);
   Keys("A");Until(()=>F(19)==2&&Num("text_visible")!=0,"returned NPC talk");Release();FieldShot("dialogue-"+cycle);ResumeField();
   for(int pages=0;F(19)==2;pages++){Assert(pages<20,"Dialogue pages");uint before=Num("text_page");Keys("A");Until(()=>F(19)!=2||Num("text_page")!=before||Num("text_visible")==0,"acknowledge");Release();}
   Until(()=>F(19)==0&&Num("npc_active")==0,"event return");Walk("D",10,10);Walk("R",11,10);Walk("L",10,10);FieldShot("walked-"+cycle);ResumeField();Walk("U",10,7);
  }
  // Controlled eligible tile/rate in the reviewed town, NOT natural reachability.
  // Keep the real map/party; drive the runtime with the controller after both
  // returns and leave the unsupported real-formation request observable.
  if(!encounterMode){PauseField();byte tile=Core.GetMemoryValue(7,0xd000+8*32+10);uint collision=0xd687+(uint)tile*2;
  byte property=Core.GetMemoryValue(7,collision);Assert((property&0x88)==0,"Safe encounter fixture tile");
  Core.SetMemoryValue(7,collision,(byte)(property|0x40));SetF(25,255);SetF(14,5);SetF(15,0);SetF(76,255);
  string seed=Bytes("field",79),party=Bytes("ff3_game_state",1024);uint steps=(uint)(F(28)|(F(29)<<8));encounterPending=true;var start=Core.GetTimingInfo(7);
  Keys("D");ResumeField();Until(()=>F(16)==4&&F(64)==0&&F(47)==0&&F(65)==0&&F(66)==0,"latched encounter after complete step");
  Assert(F(0)==3&&F(1)==1&&F(2)==0&&F(3)==0&&F(5)==0&&(uint)(F(28)|(F(29)<<8))==steps+1,"Exactly one complete tile before dispatch");
  string selected=Bytes("field",79);uint at=Num("native_consumed",4);Put("scene_request",1);Run(30);Keys("");
  Assert(Bytes("field",79)==selected&&Num("scene_phase")==1&&Num("scene_cycles")==cycleCount&&Num("scene_request")==1,"Pending real encounter cannot become a diagnostic battle or poll another step");Put("scene_request",0);
  Assert(Bytes("ff3_game_state",1024)==party&&Num("native_consumed",4)>at,"Party retained and audio advances at unsupported boundary");
  encounter=new{controlled=true,seed,selected,property=(byte)(property|0x40),statePreserved=true,audioAdvanced=Num("native_consumed",4)-at,ms=(Core.GetTimingInfo(7).clock-start.clock)*1000.0/start.rate};
  }
  while(Num("native_done")==0){Frame();Assert(total<8500,"Bounded audio completion");}done=true;
 }finally{
  if(script>=0){var log=new StringBuilder(8000000);Audit.GetScriptLog(script,log,8000000);File.WriteAllText(Text("output")+".audit.log",log.ToString());}
  uint untouched=0;while(untouched<512&&Core.GetMemoryValue(39,0x1e00+untouched)==0x5a)untouched++;
  File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{romSha256=Text("romSha256"),home=Text("home"),done,audio,requests,shots,pictures,cycles,phases,encounter,encounters,actions,rejections,stack=new{floor=0xde00,watermarkUsed=512-untouched,untouched,guard=Mem(39,0x1df0,16)},boots=Num("scene_audio_boots")}));Core.Stop();Core.Release();
 }
 }
}
