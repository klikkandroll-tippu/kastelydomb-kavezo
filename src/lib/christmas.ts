export const CHRISTMAS_PRODUCTS=[{id:"szarnyas",name:"Szárnyas tál",price:17000,unit:"tál"},{id:"malac",name:"Malac tál",price:17000,unit:"tál"},{id:"vega",name:"Vega tál",price:15000,unit:"tál"},{id:"halaszle",name:"Halászlé pontyszelettel",price:3000,unit:"adag"},{id:"rantott-ponty",name:"Egyszemélyes rántottponty-tál",price:4300,unit:"tál"},{id:"hidegtal",name:"Egyszemélyes hidegtál",price:8000,unit:"tál"},{id:"salata",name:"Hideg saláta",price:600,unit:"adag",min:5}].map(p=>({...p,description:({
"szarnyas":["1 adag Cordon bleu","1 adag szezámmagos rántott csirkemell","1 adag vaslapon sült csirkemell","1 adag gödöllői csirkerolád","Rizi-bizi és kemencés burgonya"],
"malac":["1 adag rántott, baconbe tekert menyecskeláb sajttal töltve","1 adag cigánypecsenye kakastaréjjal","1 adag rántott sertésborda","1 adag debreceni sertésrolád","Rizi-bizi és kemencés burgonya"],
"vega":["1 adag rántott trappista sajt","1 adag sokmagvas bundában sült, rántott camembert","1 adag szezámmagos rántott karfiolrózsa","1 adag kapros túróval töltött rántott gombafej","Rizi-bizi és kemencés burgonya"],
"halaszle":["Pontyszelettel"],
"rantott-ponty":["1 adag rántott pontyszelet","Majonézes burgonyasaláta"],
"hidegtal":["Kaszinótojás: 1 db","Sonkatekercs: 1 db","Debreceni rolád: 2 szelet","Sajttal töltött csirkerolád: 2 szelet","BBQ csirkecsíkok: 3 db","Fasírtgolyó: 4 db","Franciasaláta: 1 adag"],
"salata":["Franciasaláta","Majonézes burgonya","Majonézes kukorica","Majonézes tojás – a kívánt típust a megjegyzésben jelezze"]
} as Record<string,string[]>)[p.id]||[]})) as Array<{id:string;name:string;price:number;unit:string;min?:number;description:string[]}>;
export type ChristmasItem={id:string;name:string;quantity:number;unit_price_huf:number;line_total_huf:number};
export const huf=(n:number)=>new Intl.NumberFormat("hu-HU",{style:"currency",currency:"HUF",maximumFractionDigits:0}).format(n);
