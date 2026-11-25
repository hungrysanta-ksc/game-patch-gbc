import {check} from './source.mjs';
// Normalize only private stone tile IDs. Source OAM order/positions/attributes,
// every active pattern byte and every map cell remain exact oracle checks.
export function normalizeStone(p,e,layout,expectedOam){
 const base=layout.base+p.bgPage*layout.span,count=e.patterns.length/32;
 const actualPatterns=Buffer.from(p.stonePatterns,'hex'),expectedPatterns=Buffer.from(e.patterns,'hex');
 const forward=new Map(),reverse=new Map();
 function tile(expected,actual,bank1){
  if(!bank1||expected<base||expected>=base+count){check(actual===expected,'Non-stone tile changed');return actual;}
  check(actual>=base&&actual<base+layout.span,'Stone tile page boundary');
  check((!forward.has(expected)||forward.get(expected)===actual)&&(!reverse.has(actual)||reverse.get(actual)===expected),'Stone slot identity alias');
  forward.set(expected,actual);reverse.set(actual,expected);
  check(actualPatterns.subarray((actual-base)*16,(actual-base+1)*16).equals(expectedPatterns.subarray((expected-base)*16,(expected-base+1)*16)),'Retained stone pattern bytes');
  return expected;
 }
 const map=Buffer.from(p.stoneMap,'hex'),reference=Buffer.from(e.map,'hex');check(map.length===896&&reference.length===896&&map.subarray(448).equals(reference.subarray(448)),'Stone map attributes');
 for(let i=0;i<448;i++)map[i]=tile(reference[i],map[i],Boolean(reference[448+i]&8));
 const oam=Buffer.from(p.oam,'hex'),target=Buffer.from(expectedOam,'hex');check(oam.length===160&&target.length===160,'Stone OAM length');
 for(let i=0;i<160;i+=4)oam[i+2]=tile(target[i+2],oam[i+2],Boolean(target[i+3]&8));
 check(oam.equals(target),'Stone OAM order/position/attributes');
 check(forward.size===count,'Every active stone pattern referenced');
 return {map:map.toString('hex'),oam:oam.toString('hex')};
}
