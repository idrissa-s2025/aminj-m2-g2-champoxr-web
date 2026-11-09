// Socle web immersif du campus Champollion (AMINJ M2, equipe G2).
//
// Fourni : la maquette 3D et son sol, la navigation, les etiquettes des batiments, la fiche
// d'un batiment, le deplacement d'un batiment a l'autre, un agent par le relais et une trace
// xAPI a chaque action.
// A construire par le groupe (docs/A_CONSTRUIRE.md) : parcours et missions, progression,
// fonction didactique de l'agent, incarnation et voix, evaluation, debriefing.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const RELAIS = '';                       // le relais sert aussi cette page
const LEGER = new URLSearchParams(location.search).has('leger');   // sans ombres, pour les machines modestes
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ rendu
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, preserveDrawingBuffer: LEGER });
renderer.setPixelRatio(LEGER ? 1 : Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = !LEGER;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const etiquettes = new CSS2DRenderer({ element: $('etiquettes') });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 20000);
const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true;
controles.maxPolarAngle = Math.PI * 0.47;
controles.minDistance = 20;
controles.maxDistance = 700;

// Ciel de jour : un dome qui suit la camera, degrade bleu, halo du soleil et nuages animes.
// Le ciel physique (Preetham) ne sert qu'a l'eclairage d'ambiance des matieres.
const directionSoleil = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(215));
const HORIZON = new THREE.Color('#cfe3f5');
const preetham = new Sky();
preetham.scale.setScalar(1000);
Object.assign(preetham.material.uniforms.turbidity, { value: 3 });
preetham.material.uniforms.rayleigh.value = 1.4;
preetham.material.uniforms.sunPosition.value.copy(directionSoleil);
const pmrem = new THREE.PMREMGenerator(renderer);
const scenePourCiel = new THREE.Scene(); scenePourCiel.add(preetham);
scene.environment = pmrem.fromScene(scenePourCiel).texture;
scene.environmentIntensity = 0.55;

const ciel = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  uniforms: { uTemps: { value: 0 }, uSoleil: { value: directionSoleil } },
  vertexShader: `varying vec3 vDir; void main() { vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec3 vDir; uniform float uTemps; uniform vec3 uSoleil;
    float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float bruit(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { v += a * bruit(p); p *= 2.03; a *= 0.5; } return v; }
    void main() {
      vec3 d = normalize(vDir);
      float e = max(d.y, 0.0);
      vec3 zenith = vec3(0.16, 0.42, 0.80), milieu = vec3(0.42, 0.66, 0.92), horizon = vec3(${HORIZON.r.toFixed(3)}, ${HORIZON.g.toFixed(3)}, ${HORIZON.b.toFixed(3)});
      vec3 c = mix(horizon, milieu, smoothstep(0.0, 0.18, e));
      c = mix(c, zenith, smoothstep(0.18, 0.75, e));
      float s = max(dot(d, normalize(uSoleil)), 0.0);
      c += vec3(1.0, 0.93, 0.78) * (pow(s, 8.0) * 0.25 + pow(s, 900.0) * 1.5);
      if (d.y > 0.0) {
        vec2 p = d.xz / (d.y + 0.12) * 1.6 + vec2(uTemps * 0.004, uTemps * 0.0015);
        float n = fbm(p);
        float couv = smoothstep(0.50, 0.72, n) * smoothstep(0.0, 0.10, d.y);
        float ombre = smoothstep(0.55, 0.95, fbm(p + vec2(0.06, 0.04)));
        vec3 blanc = mix(vec3(1.0), vec3(0.78, 0.82, 0.90), ombre * 0.7);
        c = mix(c, blanc, couv * 0.92);
      } else {
        c = horizon;
      }
      gl_FragColor = vec4(c, 1.0);
    }`,
}));
ciel.frustumCulled = false; ciel.renderOrder = -1;
scene.add(ciel);
scene.fog = new THREE.Fog(HORIZON, 700, 4200);

scene.add(new THREE.HemisphereLight(0xdcebff, 0x80935f, 0.65));
const soleil = new THREE.DirectionalLight(0xfff3e0, 2.8);
soleil.castShadow = true;
soleil.shadow.mapSize.set(4096, 4096);
soleil.shadow.bias = -0.0004;
soleil.shadow.normalBias = 0.4;
scene.add(soleil, soleil.target);

function redimensionner() {
  renderer.setSize(innerWidth, innerHeight, false);
  etiquettes.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionner);
redimensionner();

// ------------------------------------------------------------------ donnees
const semantique = await (await fetch('donnees/campus_semantique.json')).json();
const batiments = new Map(semantique.batiments.map((b) => [b.semantic_id, b]));
// Les connaissances de l'agent : une fiche par batiment (role, histoire, pedagogie, services).
const connaissances = await (await fetch('donnees/fiches_batiments.json')).json();
const fiches = new Map(connaissances.fiches.map((f) => [f.semantic_id, f]));

// ------------------------------------------------------------------ maquette
const manager = new THREE.LoadingManager();
const draco = new DRACOLoader(manager).setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const gltf = await new GLTFLoader(manager).setDRACOLoader(draco).loadAsync('modele/campus_champollion.glb',
  (e) => { if (e.total) $('progression').textContent = Math.round((e.loaded / e.total) * 100) + ' %'; });
const maquette = gltf.scene;
scene.add(maquette);
if (LEGER) window.__campus = { scene, maquette, camera, renderer };

// Le sol. Dans Blender, la matiere SOL_Melange melange quatre revetements selon une carte
// (rouge : enrobe, vert : pavage, bleu : gravillon, noir : gazon). L'export glTF ne garde que
// la carte, d'ou le sol rouge d'origine. On applique un plan cuit a partir de cette carte
// (outils/cuire_sol.py : couleurs claires, bords de chaussee, lignes mediane), avec un grain
// discret des textures reelles pour la vue rapprochee.
const chargeur = new THREE.TextureLoader(manager);
function tuile(nom) {
  const t = chargeur.load(`textures/${nom}`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const revetements = {
  tGazon: { value: tuile('sol_gazon.jpg') }, tEnrobe: { value: tuile('sol_enrobe.jpg') },
  tPavage: { value: tuile('sol_pavage.jpg') }, tGravillon: { value: tuile('sol_gravillon.jpg') },
  tCarte: { value: null },
};
const plan = chargeur.load('textures/sol_plan.jpg');
plan.colorSpace = THREE.SRGBColorSpace; plan.flipY = false; plan.anisotropy = 16;

maquette.traverse((o) => {
  if (!o.isMesh) return;
  o.castShadow = true;
  o.receiveShadow = true;
  const m = o.material;
  if (m.name === 'SOL_Melange') {
    o.castShadow = false;
    const carte = m.map;
    carte.colorSpace = THREE.NoColorSpace;          // la carte est une donnee, pas une couleur
    revetements.tCarte.value = carte;
    m.map = plan;
    m.roughness = 0.95;
    // Coordonnees du plan calculees depuis la position (metres) : independantes des UV du maillage,
    // donc robustes a la decimation. Cadre de la carte : 438 m de cote, origine (-195.76, -203.07).
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, revetements);
      s.vertexShader = 'varying vec3 vSol;\n' + s.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vSol = position;');
      s.fragmentShader = 'varying vec3 vSol;\nuniform sampler2D tGazon, tEnrobe, tPavage, tGravillon, tCarte;\n' +
        s.fragmentShader.replace('#include <map_fragment>', `
          vec2 uvPlan = vec2((vSol.x + 195.7597) / 438.0, 1.0 - (203.0697 - vSol.z) / 438.0);
          vec2 vMetre = vSol.xz;
          vec4 couleurPlan = texture2D(map, uvPlan);
          vec3 k = texture2D(tCarte, uvPlan).rgb;
          float g = dot(texture2D(tGazon, vMetre / 2.5).rgb, vec3(0.33));
          g = mix(g, dot(texture2D(tEnrobe, vMetre / 4.0).rgb, vec3(0.33)), k.r);
          g = mix(g, dot(texture2D(tPavage, vMetre / 3.0).rgb, vec3(0.33)), k.g);
          g = mix(g, dot(texture2D(tGravillon, vMetre / 2.0).rgb, vec3(0.33)), k.b);
          diffuseColor.rgb *= couleurPlan.rgb * (0.88 + 0.32 * g);`);
    };
    m.needsUpdate = true;
  }
  // Les marquages sont poses au ras du sol : on les tire devant pour qu'ils ne s'y noient pas.
  if (m.name === 'SOL_Marquage_bande') {
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; m.depthWrite = false;
    o.castShadow = false; o.renderOrder = 1;
  }
});

// Soleil sur l'emprise du campus
const boite = new THREE.Box3().setFromObject(maquette);
const centre = boite.getCenter(new THREE.Vector3());
const rayonCampus = boite.getSize(new THREE.Vector3()).length() / 2;
// Une prairie autour de la maquette, qui se fond dans la brume de l'horizon.
const prairie = new THREE.Mesh(new THREE.CircleGeometry(6000, 64).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x8abc5e, roughness: 0.95 }));
prairie.position.set(centre.x, boite.min.y - 0.6, centre.z);
prairie.receiveShadow = false;
scene.add(prairie);
soleil.position.copy(centre).addScaledVector(directionSoleil, 450);
soleil.target.position.copy(centre);
Object.assign(soleil.shadow.camera, { left: -rayonCampus, right: rayonCampus, top: rayonCampus, bottom: -rayonCampus, far: 1400 });
soleil.shadow.camera.updateProjectionMatrix();

// ------------------------------------------------------------------ batiments
function batimentDe(objet) {
  for (let o = objet; o; o = o.parent) {
    const u = o.userData || {};
    if (batiments.has(u.semantic_id)) return u.semantic_id;
    if (batiments.has(u.ouvrage)) return u.ouvrage;
  }
  return null;
}

const emprises = new Map();              // semantic_id -> Box3
maquette.traverse((o) => {
  if (!o.isMesh) return;
  const id = batimentDe(o);
  if (!id) return;
  const b = emprises.get(id) || new THREE.Box3();
  emprises.set(id, b.union(new THREE.Box3().setFromObject(o)));
});

// Les batiments du plan, regroupes par numero (les pavillons 01, les residences 10…)
const NOMS = { '01': 'Pavillons', '02': 'Multimédia', '03': 'Jean-Jaurès', '03 bis': 'Extension Jean-Jaurès',
  '04': 'Administration', '05': 'Émile-Borel', '06': 'Bibliothèque', '07': 'Restaurant universitaire',
  '08': 'Pascal(e) Ambic', '09': 'Gymnase', '10': 'Résidences', '11': 'IFMS', '12': 'Élisa-Lemonnier' };
const groupes = new Map();               // plan_num -> { ids, emprise }
for (const [id, e] of emprises) {
  const b = batiments.get(id);
  if (!b.plan_num) continue;
  const g = groupes.get(b.plan_num) || { ids: [], emprise: new THREE.Box3() };
  g.ids.push(id); g.emprise.union(e);
  groupes.set(b.plan_num, g);
}
const plan_ = [...groupes.keys()].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
const nomPlan = (n) => NOMS[n] || batiments.get(groupes.get(n).ids[0]).nom;
const groupeDe = (id) => plan_.find((n) => groupes.get(n).ids.includes(id));

const pastilles = new Map();
for (const n of plan_) {
  const e = groupes.get(n).emprise;
  const div = document.createElement('div');
  div.className = 'etiquette';
  div.innerHTML = `<b>${n}</b>${nomPlan(n)}`;
  div.addEventListener('click', () => selectionner(groupes.get(n).ids[0], true));
  const p = new CSS2DObject(div);
  p.position.set((e.min.x + e.max.x) / 2, e.max.y + 4, (e.min.z + e.max.z) / 2);
  scene.add(p);
  pastilles.set(n, div);
}

// Vue d'accueil cadree sur les batiments, pas sur tout le terrain
const coeur = new THREE.Box3();
for (const n of plan_) coeur.union(groupes.get(n).emprise);
const centreCoeur = coeur.getCenter(new THREE.Vector3());
const rayonCoeur = coeur.getSize(new THREE.Vector3()).setY(0).length() / 2;
const vueAccueil = { cible: centreCoeur.clone(),
  position: centreCoeur.clone().add(new THREE.Vector3(-0.45, 0.24, 0.74).normalize().multiplyScalar(rayonCoeur * 1.05)) };
camera.position.copy(vueAccueil.position);
controles.target.copy(vueAccueil.cible);

// Points de teleportation : une pastille au sol devant chaque batiment du plan. Un clic pose
// le visiteur a hauteur d'yeux, face au batiment ; « Retour a l'accueil » rend la vue d'ensemble.
const terrain = [];
maquette.traverse((o) => { if (o.isMesh && o.material.map === plan) terrain.push(o); });
const pastillesSol = [];
const anneau = new THREE.MeshBasicMaterial({ color: 0xff6633, transparent: true, opacity: 0.95, depthWrite: false });
const disque = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
const sonde = new THREE.Raycaster();
for (const n of plan_) {
  const e = groupes.get(n).emprise;
  const c = e.getCenter(new THREE.Vector3());
  const versCoeur = centreCoeur.clone().sub(c).setY(0);
  if (versCoeur.lengthSq() < 1) versCoeur.set(1, 0, 0);
  versCoeur.normalize();
  const demi = e.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const recul = Math.abs(versCoeur.x) * demi.x + Math.abs(versCoeur.z) * demi.z + 7;
  const p = c.clone().addScaledVector(versCoeur, recul);
  sonde.set(new THREE.Vector3(p.x, 200, p.z), new THREE.Vector3(0, -1, 0));
  const sol = sonde.intersectObjects(terrain, false)[0];
  p.y = (sol ? sol.point.y : e.min.y) + 0.08;
  const g = new THREE.Group();
  g.position.copy(p);
  const a = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.7, 48), anneau); a.rotation.x = -Math.PI / 2;
  const d = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), disque); d.rotation.x = -Math.PI / 2;
  g.add(a, d); g.renderOrder = 2;
  g.userData = { plan: n, regard: c.clone().setY(e.min.y + Math.min(8, (e.max.y - e.min.y) * 0.5)) };
  scene.add(g);
  pastillesSol.push(g);
}

function teleporter(g) {
  const yeux = g.position.clone().add(new THREE.Vector3(0, 1.7, 0));
  const regard = g.userData.regard;
  const dir = regard.clone().sub(yeux).normalize();
  controles.minDistance = 0.5;
  controles.maxPolarAngle = Math.PI * 0.62;
  volerVers(yeux.clone().addScaledVector(dir, 2), yeux);
  selectionner(groupes.get(g.userData.plan).ids[0]);
  tracer('s_est_teleporte', g.userData.plan);
}

// Liste « Trouver un batiment »
for (const n of plan_) for (const id of groupes.get(n).ids) {
  const li = document.createElement('li');
  li.innerHTML = `<b>${n}</b>${affiche(batiments.get(id).nom)}`;
  li.addEventListener('click', () => selectionner(id, true));
  $('liste-batiments').appendChild(li);
}
function affiche(s) { return s.replace(/ — /g, ' : '); }

// ------------------------------------------------------------------ selection
let selection = null;
let surbrillance = [];

function surligner(id) {
  surbrillance.forEach(({ mesh, materiau }) => { mesh.material = materiau; });
  surbrillance = [];
  pastilles.forEach((d, k) => d.classList.toggle('active', k === groupeDe(id)));
  if (!id) return;
  maquette.traverse((o) => {
    if (o.isMesh && batimentDe(o) === id && o.material.name !== 'SOL_Melange') {
      const m = o.material.clone();
      m.emissive = new THREE.Color(0xff6633); m.emissiveIntensity = 0.35;
      surbrillance.push({ mesh: o, materiau: o.material });
      o.material = m;
    }
  });
}

function afficherFiche(b) {
  if (!b) {
    $('carte-titre').textContent = 'Le campus Champollion';
    $('carte-corps').innerHTML = `<p>Bienvenue sur la maquette 3D du campus d'Albi.</p>
      <p>Cliquez un bâtiment ou son étiquette pour afficher ses étages et ses locaux, ou choisissez
      « Trouver un bâtiment » dans le menu.</p>`;
    return;
  }
  $('carte-titre').textContent = affiche(b.nom);
  const niveaux = (b.niveaux || []).map((n) => `<h3>${n.etage === 'RDC' ? 'Rez-de-chaussée' : 'Étage ' + n.etage}</h3>
    <ul>${(n.locaux || []).map((l) => `<li>${l.nom}${l.code ? ' (' + l.code + ')' : ''}</li>`).join('')}</ul>`).join('');
  const f = fiches.get(b.semantic_id);
  $('carte-corps').innerHTML = (b.plan_num ? `<span class="num">Bâtiment ${b.plan_num}</span>` : '') +
    (f ? `<p><b>${f.role}</b></p><p>${f.histoire}</p>` : '') +
    (niveaux || '<p>Aucun local renseigné pour ce bâtiment.</p>');
  $('carte').classList.remove('replie');
}

// Vol de camera vers un batiment
let vol = null;
function volerVers(cible, position) {
  vol = { t: 0, de: { c: controles.target.clone(), p: camera.position.clone() }, a: { c: cible, p: position } };
}
function volerVersBatiment(id) {
  controles.minDistance = 20; controles.maxPolarAngle = Math.PI * 0.47;
  const e = emprises.get(id);
  const c = e.getCenter(new THREE.Vector3());
  const r = Math.max(30, e.getSize(new THREE.Vector3()).length());
  const dir = camera.position.clone().sub(controles.target).setY(0).normalize();
  volerVers(c, c.clone().add(dir.multiplyScalar(r * 1.2)).add(new THREE.Vector3(0, r * 0.9, 0)));
}

function selectionner(id, voler = false) {
  selection = id;
  surligner(id);
  afficherFiche(id && batiments.get(id));
  const n = id && groupeDe(id);
  $('defile-nom').textContent = n ? `${n} · ${nomPlan(n)}` : (id ? affiche(batiments.get(id).nom) : 'Le campus');
  if (id) { tracer('a_selectionne', id); if (voler) volerVersBatiment(id); }
}

const rayon = new THREE.Raycaster();
const pointeur = new THREE.Vector2();
let appui = null;
renderer.domElement.addEventListener('pointerdown', (e) => { appui = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!appui || Math.hypot(e.clientX - appui[0], e.clientY - appui[1]) > 5) return;   // c'etait un glisser
  pointeur.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rayon.setFromCamera(pointeur, camera);
  const pastille = rayon.intersectObjects(pastillesSol, true)[0];
  if (pastille) { teleporter(pastille.object.parent); return; }
  const touche = rayon.intersectObject(maquette, true)[0];
  selectionner(touche ? batimentDe(touche.object) : null);
});

// Defilement d'un batiment a l'autre
function decaler(pas) {
  const i = plan_.indexOf(groupeDe(selection));
  const j = i < 0 ? (pas > 0 ? 0 : plan_.length - 1) : (i + pas + plan_.length) % plan_.length;
  selectionner(groupes.get(plan_[j]).ids[0], true);
}
$('precedent').onclick = () => decaler(-1);
$('suivant').onclick = () => decaler(1);

// Retour a l'accueil
const accueil = () => {
  selectionner(null);
  controles.minDistance = 20; controles.maxPolarAngle = Math.PI * 0.47;
  volerVers(vueAccueil.cible.clone(), vueAccueil.position.clone());
};
$('retour').onclick = accueil;
$('accueil-logo').onclick = (e) => { e.preventDefault(); accueil(); };
$('replier').onclick = () => $('carte').classList.toggle('replie');

// Menu « Je souhaite »
$('souhait').onchange = (e) => {
  const v = e.target.value;
  $('liste').hidden = v !== 'trouver';
  $('agent').hidden = v !== 'agent';
  $('agent-bouton').hidden = v === 'agent';
};

// Aide
$('aide-bouton').onclick = () => $('aide').showModal();

// ------------------------------------------------------------------ traces
// Enonce xAPI simplifie : acteur, verbe, objet. Le relais l'ecrit dans relais/journal/.
function tracer(verbe, objet, resultat) {
  fetch(`${RELAIS}/api/trace`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acteur: 'visiteur', verbe, objet, resultat }) }).catch(() => {});
}

// ------------------------------------------------------------------ agent
// Brique minimale : une question, le contexte du batiment selectionne, une reponse texte.
// La fonction didactique de l'agent s'ecrit dans relais/consignes_agent.md.
function message(texte, qui) {
  const p = document.createElement('p'); p.className = `msg ${qui}`; p.textContent = texte;
  $('agent-fil').appendChild(p); $('agent-fil').scrollTop = 1e6;
  return p;
}
$('agent-bouton').onclick = () => { $('agent').hidden = false; $('agent-bouton').hidden = true; $('souhait').value = 'agent'; };
$('agent-fermer').onclick = () => { $('agent').hidden = true; $('agent-bouton').hidden = false; $('souhait').value = 'explorer'; };
$('agent-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = $('agent-question').value.trim();
  if (!question) return;
  $('agent-question').value = '';
  message(question, 'moi');
  const attente = message('…', 'agent');
  const b = selection && batiments.get(selection);
  // Contexte transmis a l'agent : le campus, puis le batiment selectionne et sa fiche.
  const campus = `${connaissances.campus.nom}. ${connaissances.campus.role}`;
  const contexte = b ? JSON.stringify({ campus, batiment: b.nom, plan: b.plan_num, niveaux: b.niveaux, fiche: fiches.get(b.semantic_id) || null })
    : JSON.stringify({ campus, histoire: connaissances.campus.histoire, reperes: connaissances.campus.reperes, batiment: 'aucun bâtiment sélectionné' });
  try {
    const r = await fetch(`${RELAIS}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, contexte }) });
    const d = await r.json();
    attente.textContent = d.reponse || d.erreur || '(réponse vide)';
    tracer('a_questionne', selection || 'campus', { question });
  } catch {
    attente.textContent = 'Le relais ne répond pas : lancer « node relais/serveur.mjs ».';
  }
});

// ------------------------------------------------------------------ boucle
$('chargement').classList.add('fini');
const horloge = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = horloge.getDelta();
  if (vol) {
    vol.t = Math.min(1, vol.t + dt / 1.4);
    const k = vol.t < 0.5 ? 2 * vol.t * vol.t : 1 - Math.pow(-2 * vol.t + 2, 2) / 2;
    controles.target.lerpVectors(vol.de.c, vol.a.c, k);
    camera.position.lerpVectors(vol.de.p, vol.a.p, k);
    if (vol.t >= 1) vol = null;
  }
  const pouls = 1 + 0.08 * Math.sin(horloge.elapsedTime * 3);
  for (const g of pastillesSol) g.scale.setScalar(pouls);
  controles.update();
  ciel.position.copy(camera.position);
  ciel.material.uniforms.uTemps.value = horloge.elapsedTime;
  renderer.render(scene, camera);
  etiquettes.render(scene, camera);
});
