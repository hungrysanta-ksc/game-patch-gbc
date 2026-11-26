import {check} from './source.mjs';import {originalSelectionView} from './battle-select-view-source.mjs';import {compactOriginalBox,drawOriginalUiText,v6Ui} from './battle-action-ui.mjs';
export function literal(text,id){const i=text.sourceIds.indexOf(id);check(i>=0,'Reviewed selection text required: '+id);const out=[];for(let p=0;p<text.messages[i].length;p+=2){const v=text.messages[i].readUInt16LE(p);if(!v)break;check(v>=32768,'Selection label controls require a consumer');out.push(v-32768);}return out;}
export function selectionViewProfile(rom,text,{back=false,actor=0,party=false}={}){const source=originalSelectionView(rom,{back,actor}),t=source.menuTiles,hp=compactOriginalBox(t,112,41),enemy=compactOriginalBox(t,48,41),command=compactOriginalBox(t,40,41);
 for(let i=0;i<4;i++){drawOriginalUiText(hp,112,t,source.hp[i].name,9,4+i*8,{hangul:text.glyphs});drawOriginalUiText(hp,112,t,party?source.hp[i].value.slice(0,5):source.hp[i].value,party?45:55,4+i*8,{compact:true,hangul:text.glyphs});drawOriginalUiText(command,40,t,literal(text,0x620+source.commands[i]),4,4+i*8,{hangul:text.glyphs});}
 drawOriginalUiText(enemy,48,t,literal(text,0x520),4,4,{hangul:text.glyphs});
 const layers=[{x:48,y:5,w:112,h:41,pixels:hp},{x:0,y:5,w:48,h:41,pixels:enemy},{x:16,y:5,w:40,h:41,pixels:command}],tiles=[89,90,91,92],cursorGlyphs=Buffer.concat(tiles.map(i=>t.subarray(i*16,i*16+16)));
 const oam=parts=>Buffer.from(parts.flatMap(p=>[p.y+16,p.x+8,60+tiles.indexOf(p.tile),8+3+((p.attr&64)?32:0)+((p.attr&128)?64:0)]));
 check(source.cursors.every(p=>!p.length||p.every(q=>tiles.includes(q.tile))),'Source hand tile identity');
 const cursorOam=Buffer.concat([oam(source.commandHand),...source.cursors.map(p=>p.length?oam(p):Buffer.alloc(16))]);
 return {back,party,enemy:false,source,uiRaster:{palette:source.menuPalette,layers,smallHp:true,layout:v6Ui},cursorGlyphs,cursorOam,env:source.env,entries:[],scope:'One original command-selection boundary; live row/target input, caller dispatch only'};
}
