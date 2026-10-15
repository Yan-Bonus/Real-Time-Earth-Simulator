import type { CosmicOptions } from '../scene/CosmicBackground'
import type { SolarOptions } from '../scene/SolarEffects'
export const DISPLAY_KEY='earth.display.preferences.v1'
export const DEFAULT_DISPLAY={cities:true,axis:false,equator:false,grid:false,observing:false,cosmic:{stars:true,nebula:false,meteors:false},solar:{daylight:true,atmosphere:true,terminator:false,subsolar:true,direction:false,tilt:false}}
export interface DisplayPreferences {cities:boolean;axis:boolean;equator:boolean;grid:boolean;observing:boolean;cosmic:CosmicOptions;solar:SolarOptions}
export function parseDisplayPreferences(raw:string|null):DisplayPreferences {
 let value:Record<string,unknown>={};try{const parsed=JSON.parse(raw??'null');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))value=parsed}catch{/* Fall back to validated defaults. */}
 const flags=<T extends Record<string,boolean>>(defaults:T,input:unknown):T=>Object.fromEntries(Object.entries(defaults).map(([key,v])=>[key,input&&typeof input==='object'&&typeof (input as Record<string,unknown>)[key]==='boolean'?(input as Record<string,boolean>)[key]:v])) as T
 return {...flags({cities:true,axis:false,equator:false,grid:false,observing:false},value),cosmic:flags(DEFAULT_DISPLAY.cosmic,value.cosmic),solar:flags(DEFAULT_DISPLAY.solar,value.solar)}
}
export function readDisplayPreferences(){try{return parseDisplayPreferences(localStorage.getItem(DISPLAY_KEY))}catch{return parseDisplayPreferences(null)}}
export function saveDisplayPreferences(value:DisplayPreferences){try{localStorage.setItem(DISPLAY_KEY,JSON.stringify(value))}catch{/* Display remains operable without storage. */}}
