export const menuDishes = [
["2026-11-02","Vöröslencseleves","Karfiolos-sajtos sertéstokány, párolt rizs","Hagymás csirkemáj, burgonya","Borzas szelet, párolt rizs"],
["2026-11-03","Zöldségleves","Bolognai spagetti, reszelt sajt","Vagdalt szelet, párolt rizs","Velővel töltött borda, pirított kockaburgonya"],
["2026-11-04","Csontleves daragaluskával","Főtt tojás, spenót, tört burgonya","Finomfőzelék, feltét","Natúr szelet pórémártással, párolt rizs"],
["2026-11-05","Árpagyöngyleves","Temesvári szelet, párolt rizs","Töltött csirkecomb, petrezselymes burgonya","Kassai töltött borda (sonka, tojás, zöldborsó), petrezselymes burgonya"],
["2026-11-06","Bakonyi betyárleves","Morzsás nudli","Káposztás tészta","Pankómorzsában sült csirkemellcsíkok, párolt rizs"],
["2026-11-09","Brokkoli krémleves","Sertés rizottó, reszelt sajt","Fokhagymás aprópecsenye, burgonya","Menyecskeláb rántva, pirított burgonya"],
["2026-11-10","Reszelt tésztaleves","Rakott burgonya","Eszterházi tokány, orsótészta","Csáki töltött borda, párolt rizs"],
["2026-11-11","Húsleves eperlevéllel","Székelykáposzta","Zöldborsófőzelék, feltét","Parajos penne grillezett csirkefalatokkal"],
["2026-11-12","Magyaros burgonyaleves","Rántott szelet, kukoricás rizs","Sertéssült, gyümölcsmártás, pirított dara","Zöldséges töltött borda, petrezselymes rizs"],
["2026-11-13","Lencsegulyás","Túrós tészta","Aranygaluska vaníliaöntettel","Sertésszelet parasztosan, tört burgonya"],
["2026-11-16","Karfiol leves","Pásztor tarhonya","Mustáros sertésragu, Párolt rizs","Csirkemájjal töltött borda, Párolt rizs"],
["2026-11-17","Gyöngybab leves","Édes-savanyú csirkecsíkok, Párolt rizs","Sertéspaprikás galuskával","Cigánypecsenye, Tepsis burgonya"],
["2026-11-18","Csontleves májgaluskával","Zöldbabfőzelék, feltét","Paradicsomos húsgombóc, Tört burgonya","Holstein szelet, Petrezselymes rizs"],
["2026-11-19","Gomba leves","Sertéssült, Burgonya, Párolt káposzta","Búboshús, Párolt rizs","Csülök Pékné módra"],
["2026-11-20","Csirke becsinált leves","Almás-fahéjas gombóc","Sajtos-tejfölös tészta","Lyoni szelet, Párolt rizs"],
["2026-11-23","Zöldséges daragaluska leves","Hentes tokány, Párolt rizs","Ázsiai csirkehúsos tészta","Tanyasi töltött borda (szalonna, mustár, cs.uborka), Hasábburgonya"],
["2026-11-24","Tojás leves","Erdélyi rakott káposzta","Zöldborsós ragu, Főtt burgonya","Párizsi szelet, Petrezselymes rizs"],
["2026-11-25","Húsleves finommetélttel","Paprikás burgonya","Kapros tökfőzelék, feltét","Sertésszelet 'Jóasszony' módra, Pirított burgonya"],
["2026-11-26","Paradicsomleves","Dubarry szelet, Párolt rizs","Rántott halfilé, Petrezselymes burgonya","Sajttal-sonkával töltött borda, Párolt rizs"],
["2026-11-27","Babgulyás","Grízes tészta baracklekvárral","Túrós derelye","Bakonyi betyárpecsenye, Petrezselymes burgonya"],
["2026-11-30","Vöröslencse leves","Rizseshús","Lecsós csirkemáj, Főtt burgonya","Kárpáti borzas szelet, Petrezselymes rizs"],
["2026-12-01","Zöldbab leves","Gombapaprikás galuskával","Bazsalikomos ragu, Párolt rizs","Kassai töltött borda (sonka,tojás,z.borsó), Tepsis burgonya"],
["2026-12-02","Csontleves kiskocka tésztával","Főtt tojás, Sóskamártás, Tört burgonya","Babfőzelék, feltét","Fűszervajas csirkemell, Párolt rizs"],
["2026-12-03","Lebbencsleves","Kentucky csirke, Párolt rizs","Vadas sertéssült, Spagetti","Velővel töltött borda, Hasábburgonya"],
["2026-12-04","Tárkonyos raguleves","Krumplis tészta","Rizsfelfújt málna öntettel","Natur szelet sajtmártással, Párolt rizs"],
];

function archiveFriday(date:string){
  const friday=new Date(date+"T12:00:00Z");
  const weekday=(friday.getUTCDay()+6)%7;
  friday.setUTCDate(friday.getUTCDate()+4-weekday);
  return friday.toISOString().slice(0,10);
}

const menuClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function menuTime(at = new Date()) {
  const parts = menuClock.formatToParts(at);
  const value = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)!.value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

export function currentMenuDays(at = new Date()) {
  const now = menuTime(at);
  return menuDishes.map(([date, soup, A, B, C]) => ({ date, soup, A, B, C, archiveOn: archiveFriday(date) }))
    .filter(({ archiveOn }) => now.date < archiveOn || (now.date === archiveOn && now.minutes < 900));
}
