using System.Runtime.InteropServices;using System.Text;using System.Text.Json;using System.Diagnostics;
class Program {
 static void Wait(Func<bool> f){var t=Stopwatch.StartNew();while(!f()){if(t.ElapsedMilliseconds>30000)throw new Exception("Debugger timeout");Thread.Sleep(1);}}
 static void Step(int n=1,int kind=6){var before=Core.GetTimingInfo(7).clock;Core.Step(7,n,kind);Wait(()=>Core.GetTimingInfo(7).clock>before&&Core.IsExecutionStopped()&&Core.IsPaused());}
 static void Main(string[] args){using var doc=JsonDocument.Parse(File.ReadAllText(args[0]));var c=doc.RootElement;
 string Text(string k)=>c.GetProperty(k).GetString()!;uint Addr(string k)=>c.GetProperty("symbols").GetProperty(k).GetUInt32();
 uint Num(string k,int n=1){uint v=0;for(int i=0;i<n;i++)v|=(uint)Core.GetMemoryValue(7,Addr(k)+(uint)i)<<(i*8);return v;}
 void Put(string k,uint v){Core.SetMemoryValue(7,Addr(k),(byte)v);}
 string Mem(int type,uint a,int n){var b=new byte[n];Core.GetMemoryValues(type,a,a+(uint)n-1,b);return Convert.ToHexString(b).ToLowerInvariant();}
 string Bytes(string k,int n)=>Mem(7,Addr(k),n);byte F(uint i)=>Core.GetMemoryValue(7,Addr("field")+i);
 void Assert(bool ok,string message){if(!ok)throw new Exception(message+" phase="+Num("scene_phase")+" field="+Bytes("field",79));}
 NativeLibrary.SetDllImportResolver(typeof(Core).Assembly,(n,a,p)=>n=="MesenCore.dll"?NativeLibrary.Load(Text("dll")):IntPtr.Zero);
 var audio=new List<object>();var requests=new List<object>();var shots=new List<object>();var entries=new List<object>();var commands=new List<object>();var fadeFrames=new List<object>();uint external=0;int frames=0,script=-1,messageReadyFrame=-1;bool mixed=c.TryGetProperty("mixed",out var mix)&&mix.GetBoolean();bool done=false,messageShot=false;string audioBase="",inventoryBefore="";
 void Frame(){Step();frames++;for(int i=0;Num("native_irq_busy")!=0||(Core.GetMemoryValue(7,0xff70)&7)!=1;i++){Assert(i<20000,"IRQ yield");Step(17,0);}
  Assert(frames<24000,"Bounded route");Assert(Num("scene_fault")+Num("scene_arena_fault")+Num("memory_fault")+Num("text_transfer_fault")+Num("ff3_error")+Num("native_underruns",2)+Num("native_max_late",2)==0,"Shared runtime/audio: "+Num("scene_fault")+","+Num("scene_arena_fault")+","+Num("memory_fault")+","+Num("text_transfer_fault")+","+Num("ff3_error")+","+Num("native_underruns",2)+","+Num("native_max_late",2));
  if(Num("scene_phase")==1)Assert((F(16)==0||F(16)==4)&&F(39)+Num("asset_error")+Num("npc_error")+Num("text_error")==0,"Field runtime");
  if(Num("scene_phase")==3)Assert(Num("party_error")==0,"Battle runtime error="+Num("party_error")+" defeat="+Num("defeat_error")+" owner="+Num("animation_video_owner")+" live="+Num("live_party_error"));
  uint serial=Num("native_external_serial",2);if(serial!=external){Assert(serial==external+1,"Sound request sequence");external=serial;requests.Add(new{tick=Num("native_external_tick",2),op=Num("native_external_op"),arg=Num("native_external_arg")});}
  if(!messageShot&&Num("scene_phase")==3&&Num("defeat_phase")==2&&Core.GetMemoryValue(7,Addr("action_script")+23)==2&&Num("live_ui_transfer")==0&&messageReadyFrame<0)messageReadyFrame=frames;
  if(!messageShot&&messageReadyFrame>=0&&frames-messageReadyFrame>=2){messageShot=true;Assert(Num("message_source",2)==1596,"Original defeat message ID");Audit.TakeScreenshot();shots.Add(new{label="defeat-message",screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}});}
  if(Num("scene_phase")==3&&Num("defeat_phase")==4)fadeFrames.Add(new{frame=frames,clock=Num("sys_time",2),elapsed=Num("defeat_frames"),level=Core.GetMemoryValue(7,0xd80e)});
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
  if(mixed){byte[] states={192,224,200};for(uint i=0;i<3;i++){Core.SetMemoryValue(7,Addr("ff3_game_state")+258+i*64,states[i]);Core.SetMemoryValue(7,Addr("ff3_game_state")+268+i*64,0);Core.SetMemoryValue(7,Addr("ff3_game_state")+269+i*64,0);}}
  for(int cycle=0;cycle<1;cycle++){
   var before=Bytes("ff3_game_state",1024);uint steps=(uint)(F(28)|F(29)<<8);string direction="D";var begin=Core.GetTimingInfo(7);
   while(Num("scene_phase")==1){int y=(F(1)+7)&63;if(F(5)==0){if(y>=27)direction="U";if(y<=19)direction="D";}Keys(direction);Frame();}Keys("");var dispatched=Core.GetTimingInfo(7);
   Until(()=>Num("scene_phase")==3&&Num("party_request")==0&&Num("party_ready")==0xa5,"Natural battle load");
   var loaded=Core.GetTimingInfo(7);uint saved=0x7000+c.GetProperty("fieldBytes").GetUInt32()+0xb70;string field=Mem(39,saved,79);var f=Convert.FromHexString(field);Assert(f[24]==181&&f[25]==6&&f[78]==8&&f[2]==0&&f[3]==0&&f[5]==0,"Source dispatch after complete tile");
   while(Num("status_stage")!=2){Put("party_step",1);Until(()=>Num("party_step")==0,"Original entrance frame");}Frame();Frame();Audit.TakeScreenshot();
   var screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)};
   string party=Bytes("ff3_game_state",1024),map=Mem(39,0x7000+c.GetProperty("fieldBytes").GetUInt32(),2031);var ready=Core.GetTimingInfo(7);
   entries.Add(new{cycle,before,party,field,steps,seed=Num("scene_rng_seed"),formation=Num("scene_formation"),background=Num("scene_background"),counts=Bytes("encounter_counts",4),type=Num("encounter_type"),first=Num("encounter_first"),rng=Bytes("battle_rng_cursor",4),profile=Num("party_profile"),screen,routeMs=(dispatched.clock-begin.clock)*1000.0/begin.rate,loadMs=(loaded.clock-dispatched.clock)*1000.0/dispatched.rate,entranceMs=(ready.clock-loaded.clock)*1000.0/loaded.rate});

   for(uint j=0;j<64;j++)Core.SetMemoryValue(7,Addr("ff3_game_state")+192+j,0);byte[] ids={10,3,10,0,100},qty={70,2,50,9,0};for(uint j=0;j<5;j++){Core.SetMemoryValue(7,Addr("ff3_game_state")+192+j,ids[j]);Core.SetMemoryValue(7,Addr("ff3_game_state")+224+j,qty[j]);}inventoryBefore=Mem(7,Addr("ff3_game_state")+192,64);
   for(int hero=0;hero<4;hero++){
    int target=0;while(target<8&&Core.GetMemoryValue(39,0x5000+808+(uint)target)==255)target++;int actor=target+4;
    for(int attempt=0;(Core.GetMemoryValue(39,0x5000+(uint)hero*64+1)&128)==0;attempt++){
     Assert(attempt<8,"Bounded lethal physical attack");
     void Record(int who,int off,byte value)=>Core.SetMemoryValue(39,0x5000+(uint)who*64+(uint)off,value);
     Record(actor,40,0);Record(actor,46,4);Record(actor,47,(byte)(128>>hero));Record(actor,48,0);Record(actor,24,100);Record(actor,29,100);Record(actor,25,200);Record(actor,30,200);Record(actor,23,4);Record(actor,28,4);Record(actor,26,0);Record(actor,31,0);
     Record(hero,3,1);Record(hero,4,0);Record(hero,33,0);Record(hero,34,0);Record(hero,35,0);
     string records=Mem(39,0x5000,828),fight=Mem(39,0x5000+832,175),cursor=Bytes("battle_rng_cursor",4);uint serial=Num("command_serial",2);int beginFrame=frames;
     Put("command_request",(uint)actor+1);Until(()=>Num("command_serial",2)>serial||Num("command_error")!=0,"Lethal dispatch");
     while(Num("command_phase")==1||Num("command_phase")==2||Num("action_request")!=0||Num("action_enabled")!=0){
      Assert(Num("command_error")+Num("action_blocked")+Num("defeat_error")==0,"Death owner command="+Num("command_error")+" block="+Num("action_blocked")+" owner="+Num("animation_video_owner")+" anim="+Num("animation_video_error")+" party="+Num("live_party_error"));Assert(frames-beginFrame<3000,"Death completion");Frame();
     }
     Frame();Frame();Audit.TakeScreenshot();commands.Add(new{actor,hero,before=records,fightBefore=fight,rngBefore=cursor,after=Mem(39,0x5000,828),fight=Mem(39,0x5000+832,175),call=Mem(39,0x5000+1008,11),rngAfter=Bytes("battle_rng_cursor",4),canonical=party,tail=Bytes("status_tail",75),screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}});
    }
   }
   Until(()=>Num("defeat_phase")==3,"Requiem input wait");for(int j=0;j<90;j++)Frame();Assert(Num("scene_phase")==3&&Num("scene_cycles")==0&&Num("defeat_phase")==3,"Defeat holds, no field revival");Audit.TakeScreenshot();shots.Add(new{label="defeat-wait",screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}});
   Audit.SetInputOverrides(0,new Audit.Buttons{A=1});Until(()=>Num("defeat_phase")==4,"A starts fade");Audit.SetInputOverrides(0,new Audit.Buttons{});Until(()=>Num("scene_phase")==5,"Original restart menu");for(int j=0;j<90;j++)Frame();Audit.TakeScreenshot();shots.Add(new{label="restart",screen=new{oam=Mem(44,0,160),vram=Mem(43,0,16384),objPalette=Mem(46,0,64),bgPalette=Mem(45,0,64),lcdc=Core.GetMemoryValue(7,0xff40)}});Assert(Num("defeat_frames")==20&&Num("defeat_error")==0&&Num("scene_cycles")==0,"20-frame fade, abandon suspended field; actual="+Num("defeat_frames"));
  }Assert(messageShot,"Displayed original defeat message");done=true;
 }finally{
  if(script>=0){var log=new StringBuilder(8000000);Audit.GetScriptLog(script,log,8000000);File.WriteAllText(Text("output")+".audit.log",log.ToString());}
  uint untouched=0;while(untouched<512&&Core.GetMemoryValue(39,0x1e00+untouched)==0x5a)untouched++;
  File.WriteAllText(Text("output"),JsonSerializer.Serialize(new{faults=new{shared=new[]{Num("scene_fault"),Num("scene_arena_fault"),Num("memory_fault"),Num("text_transfer_fault"),Num("ff3_error"),Num("native_underruns",2),Num("native_max_late",2)},action=Num("action_blocked"),owner=Num("animation_video_owner"),animation=Num("animation_video_error"),magic=Num("magic_error"),freeze=Num("effect_freeze_error"),keepHead=Num("effect_keep_head"),retained=Num("effect_retained"),baseOam=Bytes("animation_base",160),pixels=Bytes("effect_pixels",128),palettes=Bytes("effect_palettes",128)},stack=new{untouched,guard=Mem(39,0x1df0,16)},inventoryBefore,inventoryAfter=Mem(7,Addr("ff3_game_state")+192,64),fadeFrames,endState=Mem(7,0xd800,16),defeatPhase=Num("defeat_phase"),defeatFrames=Num("defeat_frames"),previous=Num("action_previous"),mixed,done,romSha256=Text("romSha256"),home=Text("home"),audioBase,audio,requests,shots,entries,commands,frames,boots=Num("scene_audio_boots")}));Core.Stop();Core.Release();
 }
 }
}
