import { exportBuild } from './apps/desktop/src/main/build/exportBuild.ts';
import { readProject } from './apps/desktop/src/main/project.ts';
void (async ()=> {
 const projectPath=process.argv[2]!;
 const outputDir=process.argv[3]!;
 const project=await readProject(projectPath);
 const profile=project.settings.build.profiles[project.settings.build.active]!;
 const result=await exportBuild(projectPath,profile,outputDir,[process.cwd()],p=>console.log(p.step,p.fraction));
 console.log(JSON.stringify(result,null,2));
})().catch((error)=>{ console.error(error); process.exitCode=1;});
