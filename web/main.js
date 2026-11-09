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
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const RELAIS = '';                       // le relais sert aussi cette page
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ rendu
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const etiquettes = new CSS2DRenderer({ element: $('etiquettes') });

const scene = new THREE.Scene();
scene.background = ciel();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
scene.fog = new THREE.Fog(0xd8e6f2, 600, 1600);

const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 5000);
const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true;
controles.maxPolarAngle = Math.PI * 0.47;
controles.minDistance = 25;
controles.maxDistance = 900;

scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x6b7a55, 0.9));
const soleil = new THREE.DirectionalLight(0xfff4e0, 2.4);
soleil.castShadow = true;
soleil.shadow.mapSize.set(4096, 4096);
soleil.shadow.bias = -0.0004;
scene.add(soleil, soleil.target);

function ciel() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d').createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#5f97d6'); g.addColorStop(0.55, '#a9c8ea'); g.addColorStop(1, '#e4edf6');
  const x = c.getContext('2d'); x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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

// ------------------------------------------------------------------ maquette
const manager = new THREE.LoadingManager();
const draco = new DRACOLoader(manager).setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const gltf = await new GLTFLoader(manager).setDRACOLoader(draco).loadAsync('modele/campus_champollion.glb',
  (e) => { if (e.total) $('progression').textContent = Math.round((e.loaded / e.total) * 100) + ' %'; });
const maquette = gltf.scene;
scene.add(maquette);

// Le sol. Dans Blender, la matiere SOL_Melange melange quatre revetements selon une carte
// (rouge : enrobe, vert : pavage, bleu : gravillon, noir : gazon). L'export glTF ne garde que
// la carte, d'ou un sol rouge : on refait ici le melange, comme dans maquette/scripts/sol_unifie.py.
const chargeur = new THREE.TextureLoader(manager);
function tuile(nom) {
  const t = chargeur.load(`textures/${nom}`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const revetements = {
  tGazon: { value: tuile('sol_gazon.jpg') }, tEnrobe: { value: tuile('sol_enrobe.jpg') },
  tPavage: { value: tuile('sol_pavage.jpg') }, tGravillon: { value: tuile('sol_gravillon.jpg') },
};

maquette.traverse((o) => {
  if (!o.isMesh) return;
  o.castShadow = true;
  o.receiveShadow = true;
  const m = o.material;
  if (m.name === 'SOL_Melange') {
    o.castShadow = false;
    m.map.colorSpace = THREE.NoColorSpace;      // la carte est une donnee, pas une couleur
    m.map.needsUpdate = true;
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, revetements);
      s.vertexShader = 'varying vec2 vMetre;\n' + s.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vMetre = uv;');
      s.fragmentShader = 'varying vec2 vMetre;\nuniform sampler2D tGazon, tEnrobe, tPavage, tGravillon;\n' +
        s.fragmentShader.replace('#include <map_fragment>', `
          vec3 carte = texture2D(map, vMapUv).rgb;
          vec3 sol = texture2D(tGazon, vMetre / 2.5).rgb;
          sol = mix(sol, texture2D(tEnrobe, vMetre / 4.0).rgb * vec3(0.46, 0.47, 0.50), carte.r);
          sol = mix(sol, texture2D(tPavage, vMetre / 3.0).rgb * vec3(1.06, 1.05, 1.02), carte.g);
          sol = mix(sol, texture2D(tGravillon, vMetre / 2.0).rgb * vec3(1.62, 1.52, 1.30), carte.b);
          diffuseColor.rgb *= sol;`);
    };
    m.needsUpdate = true;
  }
  // Les marquages sont poses au ras du sol : on les tire devant pour qu'ils ne s'y noient pas.
  if (m.name === 'SOL_Marquage_bande') {
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; m.depthWrite = false;
    o.castShadow = false; o.renderOrder = 1;
  }
});

// Cadrage et soleil sur l'emprise du campus
const boite = new THREE.Box3().setFromObject(maquette);
const centre = boite.getCenter(new THREE.Vector3());
const rayonCampus = boite.getSize(new THREE.Vector3()).length() / 2;
soleil.position.copy(centre).add(new THREE.Vector3(-180, 320, 140));
soleil.target.position.copy(centre);
Object.assign(soleil.shadow.camera, { left: -rayonCampus, right: rayonCampus, top: rayonCampus, bottom: -rayonCampus, far: 1200 });
soleil.shadow.camera.updateProjectionMatrix();
const vueAccueil = { cible: centre.clone(), position: centre.clone().add(new THREE.Vector3(-rayonCampus * 0.55, rayonCampus * 0.55, rayonCampus * 0.7)) };
camera.position.copy(vueAccueil.position);
controles.target.copy(vueAccueil.cible);

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
const plan = [...groupes.keys()].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
const nomPlan = (n) => NOMS[n] || batiments.get(groupes.get(n).ids[0]).nom;
const groupeDe = (id) => plan.find((n) => groupes.get(n).ids.includes(id));

const pastilles = new Map();
for (const n of plan) {
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

// Liste « Trouver un batiment »
for (const n of plan) for (const id of groupes.get(n).ids) {
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
  $('carte-corps').innerHTML = (b.plan_num ? `<span class="num">Bâtiment ${b.plan_num}</span>` : '') +
    (niveaux || '<p>Aucun local renseigné pour ce bâtiment.</p>');
  $('carte').classList.remove('replie');
}

// Vol de camera vers un batiment
let vol = null;
function volerVers(cible, position) {
  vol = { t: 0, de: { c: controles.target.clone(), p: camera.position.clone() }, a: { c: cible, p: position } };
}
function volerVersBatiment(id) {
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
  const touche = rayon.intersectObject(maquette, true)[0];
  selectionner(touche ? batimentDe(touche.object) : null);
});

// Defilement d'un batiment a l'autre
function decaler(pas) {
  const i = plan.indexOf(groupeDe(selection));
  const j = i < 0 ? (pas > 0 ? 0 : plan.length - 1) : (i + pas + plan.length) % plan.length;
  selectionner(groupes.get(plan[j]).ids[0], true);
}
$('precedent').onclick = () => decaler(-1);
$('suivant').onclick = () => decaler(1);

// Retour a l'accueil
const accueil = () => { selectionner(null); volerVers(vueAccueil.cible.clone(), vueAccueil.position.clone()); };
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
  const contexte = b ? JSON.stringify({ batiment: b.nom, plan: b.plan_num, niveaux: b.niveaux }) : 'Aucun bâtiment sélectionné.';
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
  controles.update();
  renderer.render(scene, camera);
  etiquettes.render(scene, camera);
});
