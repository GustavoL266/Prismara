import {serialize,type Saveable} from './save';
globalThis.addEventListener('message',(event:MessageEvent<{id:number;game:Saveable}>)=>{
  const {id,game}=event.data;
  try{globalThis.postMessage({id,raw:serialize(game)});}catch(error){globalThis.postMessage({id,error:(error as Error).message});}
});
