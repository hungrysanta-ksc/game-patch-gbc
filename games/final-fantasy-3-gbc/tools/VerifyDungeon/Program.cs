using System.Runtime.InteropServices;using System.Text;using System.Text.Json;using System.Diagnostics;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n=1,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 uint Num(string k,int n=1){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(i*8);return v;}
 void Put(string k,uint v){Core.SetMemoryValue(7,Addr(k),(byte)v);}
 void Write(string k,string hex){var b=Convert.FromHexString(hex);for(int i=0;i<b.Length;i++)Core.SetMemoryValue(7,Addr(k)+(uint)i,b[i]);}
 string Mem(int type,uint a,int n){var b=new byte[n];Core.GetMemoryValues(type,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 string Bytes(string k,int n)=>Mem(7,Addr(k),n);byte F(uint i)=>Core.GetMemoryValue(7,Addr("field")+i);
 void Assert(bool ok,string message){if(!ok)throw new Exception(message+" phase="+Num("scene_phase")+" field="+Bytes("field",79));}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);
 var audio=new List<object>();var requests=new List<object>();var shots=new List<object>();var entries=new List<object>();var commands=new List<object>();bool commandMode=c.TryGetProperty("commands",out var commandOption)&&commandOption.GetBoolean();bool deathMode=c.TryGetProperty("death",out var deathOption)&&deathOption.GetBoolean();bool deathAutomatic=c.TryGetProperty("deathAutomatic",out var autoOption)&&autoOption.GetBoolean();var magicFrames=new List<object>();object? magicAfter=null;var deathFrames=new List<object>();var postDeathFrames=new List<object>();int deathPicture=-1;uint external=0;int frames=0,script=-1;bool done=false;string audioBase="";
 void Frame(){Step();frames++;for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){Assert(i<20000,"IRQ yield");Step(17,0);}
  Assert(frames<24000,"Bounded route");Assert(Num("scene_fault")+Num("scene_arena_fault")+Num("memory_fault")+Num("text_transfer_fault")+Num("ff3_error")+Num("native_underruns",2)+Num("native_max_late",2)==0,"Shared runtime/audio");
  if(Num("scene_phase")==1)Assert((F(16)==0||F(16)==4)&&F(39)+Num("asset_error")+Num("npc_error")+Num("text_error")==0,"Field runtime");
  if(Num("scene_phase")==3)Assert(Num("party_error")==0,"Battle runtime");
  uint serial=Num("native_external_serial",2);if(serial!=external){Assert(serial==external+1,"Sound request sequence");external=serial;requests.Add(new{tick=Num("native_external_tick",2),op=Num("native_external_op"),arg=Num("native_external_arg")});}
  var t=Core.GetTimingInfo(7);audio.Add(new{master=t.clock,rate=t.rate,timer=Num("native_clock",2),consumed=Bytes("native_consumed",12),frame=frames});
 }
 void Until(Func<bool> predicate,string why,int limit=2000){for(int i=0;!predicate();i++){Assert(i<limit,why);Frame();}}
 void Keys(string k)=>Audit.SetInputOverrides(0,new Audit.Buttons{Up=(byte)(k=="U"?1:0),Down=(byte)(k=="D"?1:0)});
 void FieldShot(string label){Keys("");Until(()=>F(5)==0&&F(64)==0&&F(47)==0&&F(65)==0&&F(66)==0,"Settled field picture");Frame();Frame();Audit.TakeScreenshot();shots.Add(new{label,field=Bytes("field",79),part1=Bytes("object_part1",192),part2=Bytes("object_part2",192),oam=Mem(44,0,160),vram=Mem(43,0,16384),palette=Mem(45,0,128),state=Bytes("ff3_game_state",1024),scroll=Mem(7,0xff42,2)});}
 try{
  Core.InitDll();Core.InitializeEmu(Text("home"),IntPtr.Zero,IntPtr.Zero,true,true,true,true);Audit.ConfigureVideo();Core.SetEmulationConfig(new Core.Speed{speed=0,turbo=0,rewind=100});Assert(Core.LoadRom(Text("rom"),IntPtr.Zero),"ROM load");Core.InitializeDebugger();Core.Pause();Wait(()=>Core.IsExecutionStopped()&&Core.IsPaused());
  for(int i=0;Num("state_ready")!=0xa5;i++){Assert(i<600,"Boot");Step();}Put("state_start",6);Until(()=>Num("scene_phase")==1&&F(26)==0xa5,"Field boot");
  Assert(F(24)==181&&F(25)==6&&Num("scene_rng_ready")==2,"Source map/rate and live seed");audioBase=Bytes("native_consumed",12);var b=Convert.FromHexString(audioBase);int initialHash=b[10]|b[11]<<8;
  script=Audit.LoadScript("dungeon",Text("auditPath"),"local auditStartHash="+initialHash+"\nlocal dungeonAudit=true\n"+Text("audit"),-1);Assert(script>=0,"Audit load");FieldShot("boot");
  for(int cycle=0;cycle<3;cycle++){
   var before=Bytes("ff3_game_state",1024);uint steps=(uint)(F(28)|F(29)<<8);string direction="D";var begin=Core.GetTimingInfo(7);
   while(Num("scene_phase")==1){int y=(F(1)+7)&63;if(F(5)==0){if(y>=27)direction="U";if(y<=19)direction="D";}Keys(direction);Frame();}Keys("");var dispatched=Core.GetTimingInfo(7);
   Until(()=>Num("scene_phase")==3&&Num("party_request")==0&&Num("party_ready")==0xa5,"Natural battle load");
   var loaded=Core.GetTimingInfo(7);uint saved=0x7000+c.GetProperty("fieldBytes").GetUInt32()+0xb70;string field=Mem(39,saved,79);var f=Convert.FromHexString(field);Assert(f[24]==181&&f[25]==6&&f[78]==8&&f[2]==0&&f[3]==0&&f[5]==0,"Source dispatch after complete tile");
   while(Num("status_stage")!=2){Put("party_step",1);Until(()=>Num("party_step")==0,"Original entrance frame");}Frame();Frame();Audit.TakeScreenshot();
   var screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)};
   string party=Bytes("ff3_game_state",1024),map=Mem(39,0x7000+c.GetProperty("fieldBytes").GetUInt32(),2031);var ready=Core.GetTimingInfo(7);
   entries.Add(new{cycle,before,party,field,steps,seed=Num("scene_rng_seed"),formation=Num("scene_formation"),background=Num("scene_background"),counts=Bytes("encounter_counts",4),type=Num("encounter_type"),first=Num("encounter_first"),rng=Bytes("battle_rng_cursor",4),profile=Num("party_profile"),screen,routeMs=(dispatched.clock-begin.clock)*1000.0/begin.rate,loadMs=(loaded.clock-dispatched.clock)*1000.0/dispatched.rate,entranceMs=(ready.clock-loaded.clock)*1000.0/loaded.rate});
   if(commandMode&&cycle==0)for(int actionIndex=0;actionIndex<(deathMode?2:1);actionIndex++){
    if(deathMode&&!deathAutomatic)Put("animation_video_probe",1);
    Assert(Num("command_ready")==1,"Resident command records");int target=0;while(target<8&&Core.GetMemoryValue(39,0x5000+808+(uint)target)==255)target++;Assert(target<8,"Living enemy slot");int actor=actionIndex==0?0:target+4;
    // Explicit diagnostic intervention: preserve source-derived stats and
    // visuals, choose 1 HP for death or 2000 HP for nonlethal coverage,
    // and disable random critical. These are diagnostic interventions.
    Core.SetMemoryValue(39,0x5000+(uint)actor*64+40,0);Core.SetMemoryValue(39,0x5000+(uint)actor*64+46,4);Core.SetMemoryValue(39,0x5000+(uint)actor*64+47,(byte)(actor==0?128>>target:128));Core.SetMemoryValue(39,0x5000+(uint)actor*64+48,(byte)(actor==0?128:0));
    for(uint k=0;k<4;k++)Core.SetMemoryValue(39,0x5000+(uint)(actor==0?target+4:0)*64+3+k,(byte)(deathMode&&actionIndex==0?((k&1)==0?1:0):((k&1)==0?0xd0:7)));
    string records=Mem(39,0x5000,828),fight=Mem(39,0x5000+832,175),cursor=Bytes("battle_rng_cursor",4);int beginFrame=frames;var beginCommand=Core.GetTimingInfo(7);
    Put("command_request",(uint)actor+1);Until(()=>Num("command_serial",2)==actionIndex+1||Num("command_error")!=0,"Actual command dispatch");
    while(Num("command_phase")!=0||Num("action_request")!=0||Num("action_enabled")!=0){Assert(Num("command_error")+Num("action_blocked")==0,"Supported command/action consumer command="+Num("command_error")+" block="+Num("action_blocked")+" owner="+Num("animation_video_owner")+" animation="+Num("animation_video_error")+" strike="+Num("strike_error")+" phase="+Num("command_phase"));Assert(frames-beginFrame<3000,"Bounded complete command");Frame();
     if(deathMode&&Num("animation_video_gate")!=0){
      Assert(Num("death_video_error")==0,"Death renderer");int picture=(int)Num("death_video_picture");
      if(actionIndex==0&&Num("animation_video_owner")==10&&picture!=deathPicture&&picture<38){deathPicture=picture;Frame();bool shot=picture==0||picture==18||picture==36;if(shot)Audit.TakeScreenshot();deathFrames.Add(new{picture,shot,frame=frames,screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}});}
      if(actionIndex==1&&Num("animation_video_owner")==31){Frame();bool shot=postDeathFrames.Count==0||postDeathFrames.Count==7;if(shot)Audit.TakeScreenshot();postDeathFrames.Add(new{shot,screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}});}
      Put("animation_video_gate",0);
     }}
    Frame();Frame();Audit.TakeScreenshot();var endCommand=Core.GetTimingInfo(7);
    if(deathMode)Put("animation_video_probe",0);
    commands.Add(new{preparations=Num("death_preparations",2),prepareTicks=Num("death_prepare_ticks",4),maxPrepareTicks=Num("death_prepare_max",2),actor,credit=Mem(39,0x5000+1020,4),before=records,fightBefore=fight,rngBefore=cursor,after=Mem(39,0x5000,828),fight=Mem(39,0x5000+832,175),call=Mem(39,0x5000+1008,11),rngAfter=Bytes("battle_rng_cursor",4),canonical=party,frames=frames-beginFrame,milliseconds=(endCommand.clock-beginCommand.clock)*1000.0/beginCommand.rate,screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}});
   }
   if(deathMode&&cycle==0){
    var probe=c.GetProperty("postDeathMagic");Write("animation_state",probe.GetProperty("animation").GetString()!);Write("action_script",probe.GetProperty("script").GetString()!);
    int survivor=0;while(survivor<8&&Core.GetMemoryValue(39,0x5000+808+(uint)survivor)==255)survivor++;Assert(survivor<8,"Magic survivor");
    Core.SetMemoryValue(7,Addr("animation_state")+10,(byte)(128>>survivor));for(uint i=0;i<8;i++)Core.SetMemoryValue(7,Addr("animation_state")+40+i,Core.GetMemoryValue(39,0x5000+808+i));
    Put("animation_video_probe",(uint)(deathAutomatic?0:1));Put("action_request",1);int beginMagic=frames;
    while(Num("action_request")!=0||Num("action_enabled")!=0){Assert(Num("action_blocked")==0&&frames-beginMagic<2500,"Post-death magic owner block="+Num("action_blocked")+" owner="+Num("animation_video_owner")+" anim="+Num("animation_video_error")+" magic="+Num("magic_error")+" freeze="+Num("effect_freeze_error")+" stage="+Num("effect_freeze_stage"));Frame();if(Num("animation_video_gate")!=0){Frame();if(Num("animation_video_owner")==29)magicFrames.Add(new{source=Bytes("animation_source",160),screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}});Put("animation_video_gate",0);}}
    Put("animation_video_probe",0);Frame();Frame();Audit.TakeScreenshot();magicAfter=new{screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}};
   }
   Put("scene_request",2);Until(()=>Num("scene_phase")==1&&Num("scene_cycles")==cycle+1,"Field return");
   Assert(F(0)==f[0]&&F(1)==f[1]&&F(2)==0&&F(3)==0&&F(10)==0&&F(16)==0&&Num("scene_rng_ready")==2,"Position and new encounter owner retained");Assert(Bytes("ff3_game_state",1024)==party&&Mem(7,0xd000,2031)==map,"Canonical state and map retained");FieldShot("return-"+cycle);
  }
  uint finalSteps=(uint)(F(28)|F(29)<<8);Keys("U");Until(()=>(uint)(F(28)|F(29)<<8)>finalSteps||Num("scene_phase")!=1,"Movement after third return");Keys("");Assert(Num("scene_phase")==1,"Bounded post-return step");FieldShot("moved");done=true;
 }finally{
  if(script>=0){var log=new StringBuilder(8000000);Audit.GetScriptLog(script,log,8000000);File.WriteAllText(Text("output")+".audit.log",log.ToString());}
  uint untouched=0;while(untouched<512&&Core.GetMemoryValue(39,0x1e00+untouched)==0x5a)untouched++;
  File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{faults=new{action=Num("action_blocked"),owner=Num("animation_video_owner"),animation=Num("animation_video_error"),magic=Num("magic_error"),freeze=Num("effect_freeze_error"),keepHead=Num("effect_keep_head"),retained=Num("effect_retained"),baseOam=Bytes("animation_base",160),pixels=Bytes("effect_pixels",128),palettes=Bytes("effect_palettes",128)},stack=new{untouched,guard=Mem(39,0x1df0,16)},done,romSha256=Text("romSha256"),home=Text("home"),audioBase,audio,requests,shots,entries,commands,deathFrames,postDeathFrames,magicFrames,magicAfter,frames,boots=Num("scene_audio_boots")}));Core.Stop();Core.Release();
 }
 }
}
