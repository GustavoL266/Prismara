import { Mat, materials } from '../sim/materials';

export interface MatterPresentation { palette: readonly string[]; flecks:number; edge:number; alpha:number; highlight:number; emission?:number }
/** Display choices are separate from density, motion and reaction recipes. */
export const PRESENTATION: readonly MatterPresentation[]=materials.map(m=>({palette:m.palette,flecks:16,edge:.70,alpha:m.state==='gas'?95:255,highlight:1.1}));
const set=(mat:Mat,p:Partial<MatterPresentation>)=>Object.assign(PRESENTATION[mat],p);
set(Mat.Sand,{palette:['#D6AF59','#E8CA7C','#B98C3C','#F0DA93'],flecks:18,edge:.78});
set(Mat.Water,{palette:['#358ECC','#53B8E3','#1F60A5'],flecks:0,edge:.85,highlight:1.22});
set(Mat.WetSand,{palette:['#928351','#B0A36A','#756D43'],flecks:28,edge:.78});
set(Mat.Pulp,{palette:['#A6AA78','#BFC28C','#7F855B'],flecks:32,edge:.8});
set(Mat.Residue,{palette:['#8B8376','#A0988B','#6A665F'],flecks:22});
set(Mat.Calcined,{palette:['#775A4E','#927466','#593F37'],flecks:24});
set(Mat.Steam,{palette:['#C1CDD3','#DBE4E8'],alpha:75,flecks:0});
set(Mat.Mist,{palette:['#ABD4E5','#D3EAF4'],alpha:95,flecks:0});
set(Mat.Molten,{palette:['#FFCB68','#FFE69C','#DF7C36'],flecks:12,emission:12});
set(Mat.Quartz,{palette:['#B8C2C4','#DDE5E4','#87969C'],flecks:20});
set(Mat.Crystal,{palette:['#AA66DC','#D99FF0','#793BA9'],flecks:12,emission:6});
