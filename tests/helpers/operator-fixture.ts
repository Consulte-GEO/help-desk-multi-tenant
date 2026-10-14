/** Test-only scope: even a partially applied setup must undo and verify its state. */
export async function withOperatorFixture(
 fixture:{apply:()=>Promise<unknown>;undo:()=>Promise<unknown>},
 probe:()=>Promise<unknown>,verifyRestored:()=>Promise<void>
):Promise<void>{
 try{await fixture.apply();await probe();}
 finally{await fixture.undo();await verifyRestored();}
}
