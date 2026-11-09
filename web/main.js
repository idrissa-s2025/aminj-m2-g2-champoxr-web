// Socle web immersif du campus Champollion (AMINJ M2, equipe G2).
//
// Ce qui est fourni : la maquette 3D, la navigation orbitale, la selection d'un batiment,
// sa fiche issue de campus_semantique.json, un appel a l'agent par le relais et une trace
// xAPI simplifiee a chaque action.
//
// Ce qui reste a construire par le groupe (voir docs/A_CONSTRUIRE.md) : le parcours et les
// missions, la progression, l'agent incarne et sa fonction didactique, la voix, l'evaluation.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Le relais sert aussi cette page : meme origine, donc chemin relatif.
const RELAIS = '';

// ------------------------------------------------------------------ scene
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b1e);
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 5000);
const controles = new OrbitControls(camera, canvas);
controles.enableDamping = true;
controles.maxPolarAngle = Math.PI * 0.48;
scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.2));
const soleil = new THREE.DirectionalLight(0xffffff, 1.5);
soleil.position.set(200, 400, 150);
scene.add(soleil);

function redimensionner() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionner);
redimensionner();

// ------------------------------------------------------------------ donnees
const semantique = await (await fetch('donnees/campus_semantique.json')).json();
const batiments = new Map(semantique.batiments.map((b) => [b.semantic_id, b]));

// ------------------------------------------------------------------ maquette
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('modele/campus_champollion.glb');
const maquette = gltf.scene;
scene.add(maquette);
document.getElementById('chargement').remove();

const boite = new THREE.Box3().setFromObject(maquette);
const centre = boite.getCenter(new THREE.Vector3());
const taille = boite.getSize(new THREE.Vector3()).length();
controles.target.copy(centre);
camera.position.copy(centre).add(new THREE.Vector3(taille * 0.35, taille * 0.4, taille * 0.45));
controles.update();

// Un mesh porte un semantic_id dans ses extras glTF (userData dans three.js). La semantique
// vit dans le JSON, pas dans le modele : on remonte jusqu'au batiment connu.
function batimentDe(objet) {
  for (let o = objet; o; o = o.parent) {
    const u = o.userData || {};
    if (batiments.has(u.semantic_id)) return u.semantic_id;
    if (batiments.has(u.ouvrage)) return u.ouvrage;
  }
  return null;
}

// ------------------------------------------------------------------ selection
const rayon = new THREE.Raycaster();
const pointeur = new THREE.Vector2();
let selection = null;
let surbrillance = [];

function surligner(id) {
  surbrillance.forEach(({ mesh, materiau }) => { mesh.material = materiau; });
  surbrillance = [];
  if (!id) return;
  maquette.traverse((o) => {
    if (o.isMesh && batimentDe(o) === id) {
      const m = o.material.clone();
      if (m.emissive) { m.emissive = new THREE.Color(0xff6633); m.emissiveIntensity = 0.6; }
      surbrillance.push({ mesh: o, materiau: o.material });
      o.material = m;
    }
  });
}

function afficherFiche(b) {
  const fiche = document.getElementById('fiche');
  fiche.hidden = !b;
  if (!b) return;
  document.getElementById('fiche-nom').textContent = b.nom;
  document.getElementById('fiche-plan').textContent = b.plan_num ? `Bâtiment ${b.plan_num} sur le plan` : '';
  const ul = document.getElementById('fiche-niveaux');
  ul.innerHTML = '';
  for (const n of b.niveaux || []) {
    const li = document.createElement('li');
    li.textContent = `${n.etage} : ${(n.locaux || []).map((l) => l.nom).join(', ')}`;
    ul.appendChild(li);
  }
}

canvas.addEventListener('click', (e) => {
  pointeur.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rayon.setFromCamera(pointeur, camera);
  const touche = rayon.intersectObject(maquette, true)[0];
  selection = touche ? batimentDe(touche.object) : null;
  surligner(selection);
  afficherFiche(selection && batiments.get(selection));
  if (selection) tracer('a_selectionne', selection);
});

// ------------------------------------------------------------------ traces
// Enonce xAPI simplifie : acteur, verbe, objet. Le relais l'ecrit dans relais/journal/.
function tracer(verbe, objet, resultat) {
  fetch(`${RELAIS}/api/trace`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acteur: 'visiteur', verbe, objet, resultat }) }).catch(() => {});
}

// ------------------------------------------------------------------ agent
// Brique minimale : une question, le contexte du batiment selectionne, une reponse texte.
// La fonction didactique de l'agent s'ecrit dans relais/consignes_agent.md.
const sortie = document.getElementById('agent-reponse');
document.getElementById('agent-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const champ = document.getElementById('agent-question');
  const question = champ.value.trim();
  if (!question) return;
  champ.value = '';
  sortie.textContent = '…';
  const b = selection && batiments.get(selection);
  const contexte = b ? JSON.stringify({ batiment: b.nom, plan: b.plan_num, niveaux: b.niveaux }) : 'Aucun bâtiment sélectionné.';
  try {
    const r = await fetch(`${RELAIS}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, contexte }) });
    const d = await r.json();
    sortie.textContent = d.reponse || d.erreur || '(réponse vide)';
    tracer('a_questionne', selection || 'campus', { question });
  } catch {
    sortie.textContent = 'Le relais ne répond pas : lancer « node relais/serveur.mjs ».';
  }
});

// ------------------------------------------------------------------ boucle
renderer.setAnimationLoop(() => { controles.update(); renderer.render(scene, camera); });
