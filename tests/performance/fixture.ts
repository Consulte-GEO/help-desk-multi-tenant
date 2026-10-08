/** Ownership boundary for the existing disposable capacity scenarios; never a hosted runner. */
export async function withCapacityFixture<T extends {pool:{end():Promise<void>}},R>(
 fingerprint:()=>Promise<string>,
 createFixture:()=>Promise<T>,
 run:(fixture:T,source:string)=>Promise<R>
):Promise<R>{
 // A failed fingerprint must not acquire any fixture, connection or business data.
 const source=await fingerprint();
 // The factory owns partial-setup cleanup until it returns successfully.
 const fixture=await createFixture();
 try{return await run(fixture,source);}finally{await fixture.pool.end();}
}
