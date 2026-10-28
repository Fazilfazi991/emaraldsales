/** Short-lived screen data only. No storage, session or authorization decisions. */
export class ScreenReads {
  private scope="";
  private generation=0;
  private entries=new Map<string,{value:unknown;until:number}>();
  constructor(private ttl=15000, private clock=()=>Date.now()){}
  setScope(scope:string){if(scope!==this.scope){this.clear();this.scope=scope;}}
  clear(){this.entries.clear();this.generation++;}
  async get<T>(path:string,load:()=>Promise<T>,authorize:()=>Promise<void>,signal?:AbortSignal):Promise<T>{
    const cached=this.entries.get(path),generation=this.generation;
    if(cached && cached.until>this.clock()){
      // A cached record is never a substitute for a current server session check.
      await authorize();
      if(signal?.aborted)throw new DOMException("Navigation cancelled","AbortError");
      if(generation!==this.generation)return this.get(path,load,authorize,signal);
      return structuredClone(cached.value) as T;
    }
    const value=await load();
    if(!signal?.aborted && generation===this.generation){
      if(this.entries.size>=50)this.entries.delete(this.entries.keys().next().value!);
      this.entries.set(path,{value:structuredClone(value),until:this.clock()+this.ttl});
    }
    return value;
  }
}
