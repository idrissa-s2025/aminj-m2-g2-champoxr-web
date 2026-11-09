// Decimation ciblee de la maquette web : arbres et mobilier fortement, batiments et terrain a peine.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplifyPrimitive, weld, dedup, prune, textureCompress, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [src, dst] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const doc = await io.read(src);
await MeshoptSimplifier.ready;
await doc.transform(dedup(), weld());

function regle(nom) {
  if (/^ARB_|FEUILL|HAIE|GRIMP/.test(nom)) return { ratio: 0.1, error: 0.04, libre: true };        // vegetation
  if (/^(LIB_HORLOGE|LIB_POT|MESHY)/.test(nom)) return { ratio: 0.12, error: 0.01, libre: true };    // objets scannes
  if (/^(CLO_|PARK_|MOB_|INT_|LIB_)/.test(nom)) return { ratio: 0.4, error: 0.01, libre: /^CLO_PANNEAUX/.test(nom) };     // clotures, mobilier, menuiseries
  if (/^TERRAIN$/.test(nom)) return { ratio: 0.6, error: 0.0004 };                       // le sol : 18 cm au plus
  return { ratio: 0.75, error: 0.0015 };                                                 // batiments, toitures
}
let avant = 0, apres = 0;
const tri = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
for (const mesh of doc.getRoot().listMeshes()) {
  const r = regle(mesh.getName());
  for (const p of mesh.listPrimitives()) {
    avant += tri(p);
    simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: r.ratio, error: r.error, lockBorder: !r.libre });
    apres += tri(p);
  }
}
await doc.transform(prune({ keepAttributes: true }), textureCompress({ encoder: sharp, resize: [2048, 2048] }), draco());
await io.write(dst, doc);
console.log(`triangles uniques : ${Math.round(avant)} -> ${Math.round(apres)}`);
