import { NextRequest, NextResponse } from "next/server";
import {authorized,configError,db} from "@/lib/admin-server";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
 const config=configError();if(config)return config;
 if(!authorized(req))return NextResponse.json({error:"Hibás admin jelszó."},{status:401,headers:{"Cache-Control":"no-store"}});
 const response=await db("kastelydomb_orders?select=*&order=created_at.desc&limit=500");
 if(!response.ok)return NextResponse.json({error:"Az adatbázis nem érhető el, vagy hiányzik a rendelési tábla."},{status:502});
 return NextResponse.json({orders:await response.json()},{headers:{"Cache-Control":"no-store"}});
}
