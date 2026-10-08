import{n as e,s as t}from"./prop-types-C98rxrTl.js";import{S as n,h as r,wt as i,zt as a}from"./src-MnoDbzqu.js";import{J as o}from"./src-CHbuFlHV.js";import{At as s,Ba as c,Bn as l,D as u,K as d,Qt as f,Tn as p,Ua as m,Va as h,Xt as g,bn as _,ct as v,en as y,ft as b,kn as x,n as S,nn as C,ot as w,pn as T,rn as E,rr as D,tn as O,x as k}from"./src-DEwN59Aw.js";import{w as A}from"./Download-BpfOKjJw.js";import{a as j,o as M,p as N,t as P}from"./index-Cj6cX9HR.js";var F=t(e((e=>{var t=c();Object.defineProperty(e,"__esModule",{value:!0}),e.default=void 0;var n=t(D()),r=h();e.default=(0,n.default)((0,r.jsx)(`path`,{d:`M16.01 11H4v2h12.01v3L20 12l-3.99-4z`}),`ArrowRightAlt`)}))()),I=t(m()),L=t(N());function R(){L.default.send({hitType:`pageview`,page:`/doc`});let{params:{currentTab:e}}=b(`/doc/:currentTab`)??{params:{currentTab:``}};return C(f,{children:[C(_,{container:!0,sx:{px:2,py:1},children:[O(_,{item:!0,flexGrow:1,children:O(l,{variant:`h6`,children:`Documentation`})}),O(_,{item:!0,children:O(l,{variant:`h6`,children:O(s,{color:`info`,children:`Version 3`})})})]}),O(a,{}),O(p,{children:C(_,{container:!0,spacing:1,children:[O(_,{item:!0,xs:12,md:2,children:O(f,{bgt:`light`,sx:{height:`100%`},children:C(j,{orientation:`vertical`,value:e,"aria-label":`Documentation Navigation`,sx:{borderRight:1,borderColor:`divider`},children:[O(M,{label:`Overview`,value:``,component:P,to:``}),O(M,{label:`Key naming convention`,value:`KeyNaming`,component:P,to:`KeyNaming`}),O(M,{label:O(`code`,{children:`StatKey`}),value:`StatKey`,component:P,to:`StatKey`}),O(M,{label:O(`code`,{children:`ArtifactSetKey`}),value:`ArtifactSetKey`,component:P,to:`ArtifactSetKey`}),O(M,{label:O(`code`,{children:`CharacterKey`}),value:`CharacterKey`,component:P,to:`CharacterKey`}),O(M,{label:O(`code`,{children:`WeaponKey`}),value:`WeaponKey`,component:P,to:`WeaponKey`}),O(M,{label:O(`code`,{children:`MaterialKey`}),value:`MaterialKey`,component:P,to:`MaterialKey`}),O(M,{label:`Version History`,value:`VersionHistory`,component:P,to:`VersionHistory`})]})})}),O(_,{item:!0,xs:12,md:10,children:O(f,{bgt:`light`,sx:{height:`100%`},children:O(p,{children:O(I.Suspense,{fallback:O(T,{variant:`rectangular`,width:`100%`,height:600}),children:C(v,{children:[O(w,{index:!0,element:O(U,{})}),O(w,{path:`/VersionHistory`,element:O(X,{})}),O(w,{path:`/MaterialKey`,element:O(Y,{})}),O(w,{path:`/ArtifactSetKey`,element:O(K,{})}),O(w,{path:`/WeaponKey`,element:O(J,{})}),O(w,{path:`/CharacterKey`,element:O(q,{})}),O(w,{path:`/StatKey`,element:O(G,{})}),O(w,{path:`/KeyNaming`,element:O(W,{})})]})})})})})]})})]})}var z=`interface IGOOD {
  format: "GOOD" // A way for people to recognize this format.
  version: number // GOOD API version.
  source: string // The app that generates this data.
  characters?: ICharacter[]
  artifacts?: IArtifact[]
  weapons?: IWeapon[]
  materials?: { // Added in version 2
    [key:MaterialKey]: number
  }
}`,B=`interface IArtifact {
  setKey: SetKey //e.g. "GladiatorsFinale"
  slotKey: SlotKey //e.g. "plume"
  level: number //0-20 inclusive
  rarity: number //1-5 inclusive
  mainStatKey: StatKey
  location: CharacterKey|"" //where "" means not equipped.
  lock: boolean //Whether the artifact is locked in game.
  substats: ISubstat[]
  // Below are new to GOOD 3
  totalRolls?: number // 3-9 for valid 5* artifacts; includes starting rolls
  astralMark?: boolean // Favorite star in-game
  elixirCrafted?: boolean // Flag for if the artifact was created using Sanctifying Elixir. This guarantees the main stat + 2 additional rolls on the first 2 substats
  unactivatedSubstats?: ISubstat[] // Unactivated substat(s). Once a substat is activated, it should be moved to \`substats\` instead
}

interface ISubstat {
  key: StatKey //e.g. "critDMG_"
  value: number //e.g. 19.4
  // Below is new to GOOD 3
  initialValue?: number // Initial roll of the artifact, if it is known. This includes the first roll of this stat, even if it was not revealed initially e.g. from \`unactivatedSubstats\`
}

type SlotKey = "flower" | "plume" | "sands" | "goblet" | "circlet"`,V=`interface IWeapon {
  key: WeaponKey //"CrescentPike"
  level: number //1-90 inclusive
  ascension: number //0-6 inclusive. need to disambiguate 80/90 or 80/80
  refinement: number //1-5 inclusive
  location: CharacterKey | "" //where "" means not equipped.
  lock: boolean //Whether the weapon is locked in game.
}`,H=`interface ICharacter {
  key: CharacterKey //e.g. "Rosaria"
  level: number //1-100 inclusive
  constellation: number //0-6 inclusive
  ascension: number //0-6 inclusive. need to disambiguate 80/90 or 80/80
  talent: { //does not include boost from constellations. 1-15 inclusive
    auto: number
    skill: number
    burst: number
  }
}`;function U(){return C(y,{children:[O(l,{gutterBottom:!0,variant:`h4`,children:`Genshin Open Object Description (GOOD)`}),C(l,{gutterBottom:!0,children:[O(`strong`,{children:`GOOD`}),` is a data format description to map Genshin Data into a parsable JSON. This is intended to be a standardized format to allow Genshin developers/programmers to transfer data without needing manual conversion.`]}),O(l,{gutterBottom:!0,children:`As of version 6.0.0, Genshin Optimizer's database export conforms to this format.`}),O(g,{text:z}),O(`br`,{}),O(l,{gutterBottom:!0,variant:`h4`,children:`Artifact data representation`}),O(g,{text:B}),O(`br`,{}),O(l,{gutterBottom:!0,variant:`h4`,children:`Weapon data representation`}),O(g,{text:V}),O(`br`,{}),O(l,{gutterBottom:!0,variant:`h4`,children:`Character data representation`}),O(g,{text:H})]})}function W(){return C(f,{children:[O(p,{children:O(l,{children:`Key Naming Convention`})}),O(a,{}),C(p,{children:[C(l,{gutterBottom:!0,children:[`The keys in the GOOD format, like Artifact sets, weapon keys, character keys, are all in `,O(`strong`,{children:`PascalCase`}),`. This makes the name easy to derive from the in-game text, assuming no renames occur. If a rename is needed, then the standard will have to increment versions. (Last change was in 1.2 when the Prototype weapons were renamed)`]}),C(l,{gutterBottom:!0,children:[` `,`To derive the PascalKey from a specific name, remove all symbols from the name, and Capitalize each word:`]}),C(l,{children:[O(`code`,{children:`Gladiator's Finale`}),` `,O(F.default,{sx:{verticalAlign:`bottom`}}),` `,O(`code`,{children:`GladiatorsFinale`})]}),C(l,{children:[O(`code`,{children:`Spirit Locket of Boreas`}),` `,O(F.default,{sx:{verticalAlign:`bottom`}}),` `,O(`code`,{children:`SpiritLocketOfBoreas`})]}),C(l,{children:[O(`code`,{children:`"The Catch"`}),` `,O(F.default,{sx:{verticalAlign:`bottom`}}),` `,O(`code`,{children:`TheCatch`})]})]})]})}function G(){let{t:e}=E(`statKey_gen`),t=`type StatKey\n  = ${[`hp`,`hp_`,`atk`,`atk_`,`def`,`def_`,`eleMas`,`enerRech_`,`heal_`,`critRate_`,`critDMG_`,`physical_dmg_`,`anemo_dmg_`,`geo_dmg_`,`electro_dmg_`,`hydro_dmg_`,`pyro_dmg_`,`cryo_dmg_`,`dendro_dmg_`].map(t=>`"${t}" //${e(t)}${o(t)}`).join(`
  | `)}`;return C(y,{children:[O(l,{gutterBottom:!0,variant:`h4`,children:`StatKey`}),O(g,{text:t})]})}function K(){let{t:e}=E(`artifactNames_gen`),t=`type ArtifactSetKey\n  = ${[...new Set(d)].sort().map(t=>`"${t}" //${e(`artifactNames_gen:${t}`)}`).join(`
  | `)}`;return C(y,{children:[O(l,{gutterBottom:!0,variant:`h4`,children:`ArtifactSetKey`}),O(g,{text:t})]})}function q(){let{t:e}=E(`charNames_gen`),t=n(),{gender:i}=r(),a=`type CharacterKey\n  = ${[...new Set(k)].sort().map(n=>`"${n}" //${e(`charNames_gen:${u(t.chars.LocationToCharacterKey(n),i)}`)}`).join(`
  | `)}`;return C(y,{children:[O(l,{gutterBottom:!0,variant:`h4`,children:`CharacterKey`}),O(g,{text:a})]})}function J(){let{t:e}=E(`weaponNames_gen`),t=`type WeaponKey\n  = ${[...new Set(S)].sort().map(t=>`"${t}" //${e(`weaponNames_gen:${t}`)}`).join(`
  | `)}`;return C(y,{children:[O(l,{gutterBottom:!0,variant:`h4`,children:`WeaponKey`}),O(g,{text:t})]})}function Y(){let{t:e}=E(`material_gen`),t=`type MaterialKey\n  = ${Object.keys(i.material).sort().map(t=>`"${t}" // ${e(`${t}.name`)}`).join(`
  | `)}`;return C(y,{children:[O(l,{gutterBottom:!0,variant:`h4`,children:`MaterialKey`}),C(l,{gutterBottom:!0,children:[`The item names are taken from the english translation, and then converted into`,` `,O(A,{component:P,to:`KeyNaming`,children:O(`code`,{children:`PascalCase`})}),`.`]}),O(g,{text:t})]})}function X(){return C(x,{display:`flex`,flexDirection:`column`,gap:2,children:[O(l,{gutterBottom:!0,variant:`h4`,children:`Version History`}),C(f,{children:[O(p,{children:O(l,{children:`Version 1`})}),O(a,{}),O(p,{children:C(l,{children:[`Created general `,O(`code`,{children:`IGOOD`}),` format with character, weapon, artifact fields.`]})})]}),C(f,{children:[O(p,{children:O(l,{children:`Version 2`})}),O(a,{}),O(p,{children:C(l,{children:[`Adds `,O(`code`,{children:`materials`}),` field to `,O(`code`,{children:`IGOOD`}),`. All other fields remain the same. V2 is backwards compatible with V1.`]})})]}),C(f,{children:[O(p,{children:O(l,{children:`Version 3`})}),O(a,{}),O(p,{children:C(l,{children:[`Adds new fields to `,O(`code`,{children:`IArtifact`}),` to represent new in-game properties, store initial rolls for reroll information, and help differentiate between 3 and 4-line starts for 5* artifacts. All other fields remain the same. V3 is backwards compatible with V2.`,O(`br`,{}),`New fields for `,O(`code`,{children:`IArtifact`}),`:`,` `,O(`code`,{children:`totalRolls, astralMark, elixirCrafted, unactivatedSubstats`}),O(`br`,{}),`New field for `,O(`code`,{children:`ISubstat`}),`: `,O(`code`,{children:`initialValue`})]})})]})]})}export{R as default};