export interface TerrainPoint { x:number; y:number }
export type ChamberId='drain'|'thaw'|'feed';
export interface Chamber extends TerrainPoint { id:ChamberId; name:string }
export type RoomFamily='gallery'|'hall'|'arch'|'inclined'|'lobes'|'pillars'|'basin'|'pocket';
export interface PlannedRoom extends TerrainPoint { id:number; rx:number; ry:number; angle:number; family:RoomFamily; region:number; isolated:boolean; chamber?:ChamberId }
export interface PlannedTunnel { from:number; to:number; extra:boolean; points:TerrainPoint[]; radii:number[] }
export interface Reservoir { kind:'basin'|'starter'|'drain'; level:number; count:number; bounds:{left:number;top:number;right:number;bottom:number} }
export interface TerrainData { version:number; surface:number[]; boundaries:number[][]; entry:TerrainPoint; rooms:PlannedRoom[]; tunnels:PlannedTunnel[]; chambers:Chamber[]; reservoirs:Reservoir[] }
export const GENERATOR_VERSION=2;
export const TERRAIN_CONFIG={referenceArea:1024*(1536-172),roomCount:62,minimumRooms:3,roomWidth:[34,76],roomHeight:[22,55],roomGap:12,minimumWall:8,regionalDensity:[0,1.18,1.25,.95,.95,.88],tunnelRadius:[9,14],tunnelSample:3,tunnelBend:[14,48],extraConnections:.18,deformation:{broad:.15,medium:.065,fine:.012},refinementPasses:2,isolatedFraction:.065,reservoirFraction:.19,waterDepth:[7,15],mineralVeins:92,mineralRadius:[2,7],sandDepth:38,boundaryFractions:[.028,.23,.46,.66,.84],boundaryWarp:.033} as const;
