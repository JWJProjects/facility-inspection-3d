import {build} from 'esbuild';
await build({
  entryPoints:['export-studio-entry.ts'],
  bundle:true,platform:'node',format:'cjs',outfile:'export-studio.bundle.cjs',
  external:['esbuild'],
  alias:{'@three-studio/core':'./packages/core/src/index.ts'},
  plugins:[{name:'electron-guard-for-standalone-export',setup(build){
    build.onResolve({filter:/^electron$/},()=>({path:'only-used-by-recent-store',namespace:'electron-guard'}));
    build.onLoad({filter:/.*/,namespace:'electron-guard'},()=>({contents:"export const app = {getPath(){throw new Error('The official export adapter accessed Electron unexpectedly')}}; export const nativeImage = {createFromBuffer(){throw new Error('Export adapter unexpectedly encountered raster input')}};"}));
  }}]
});
