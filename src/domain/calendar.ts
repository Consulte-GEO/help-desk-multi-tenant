export type BusinessCalendar={timezone:string;week:Readonly<Partial<Record<number,readonly (readonly [number,number])[]>>>;holidays:readonly string[]};
/** Reference engine with a bounded minute scan. Not enabled as the operational SLA scheduler. */
export function addBusinessMinutes(start:string,minutes:number,calendar:BusinessCalendar):string{
  let cursor=Date.parse(start);
  if(!Number.isFinite(cursor)||!Number.isSafeInteger(minutes)||minutes<0||minutes>525600)throw new TypeError('Data ou duração inválida.');
  const intervals=Object.values(calendar.week).flatMap(x=>x??[]);
  if(minutes>0&&intervals.length===0)throw new TypeError('Calendário sem jornada.');
  for(const [day,ranges] of Object.entries(calendar.week)){
    if(!Number.isInteger(Number(day))||Number(day)<0||Number(day)>6)throw new TypeError('Dia inválido.');
    let end=-1;
    for(const [from,to] of [...ranges!].sort((a,b)=>a[0]-b[0])){
      if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>1440||from>=to||from<end)throw new TypeError('Jornadas inválidas ou sobrepostas.');
      end=to;
    }
  }
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:calendar.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'});
  const holidays=new Set(calendar.holidays);
  const days:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  let remaining=minutes*60000;
  const limit=cursor+370*86400000;
  while(remaining>0){
    if(cursor>=limit)throw new RangeError('Calendário excedeu horizonte de cálculo de 370 dias.');
    const p=Object.fromEntries(formatter.formatToParts(cursor).map(x=>[x.type,x.value]));
    const date=`${p.year}-${p.month}-${p.day}`;
    const minute=Number(p.hour)*60+Number(p.minute);
    const day=days[p.weekday!]!;
    const working=!holidays.has(date)&&(calendar.week[day]??[]).some(([a,b])=>minute>=a&&minute<b);
    const step=60000-(cursor%60000);
    if(working){const used=Math.min(step,remaining);cursor+=used;remaining-=used;}else cursor+=step;
  }
  return new Date(cursor).toISOString();
}
