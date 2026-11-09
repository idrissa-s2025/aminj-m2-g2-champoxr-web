# ChampoXR · équipe web immersif (G2)

Socle de projet du Master 2 AMINJ, INU Champollion, 2026-2027.
Module « Développer une ingénierie pédagogique pour les serious games ».

Ce dépôt n'est pas le projet complet. C'est une **base de départ ciblée** : le campus en 3D
dans le navigateur, sans casque, ses données, la sélection d'un bâtiment et une brique
d'agent OpenAI propre. Ce qui en fait une **formation** reste à concevoir par le groupe.
Référence d'inspiration : le campus 3D de l'ESNbyUM (Université de Montpellier), qui est un
portail, pas une formation.

## Ce que contient le socle

| Élément | Où | État |
|---|---|---|
| Maquette texturée du campus, décimée (glTF Draco, 20 Mo, environ 300 000 triangles uniques) | `web/modele/campus_champollion.glb` | fourni |
| Plan du sol cuit : gazon, enrobé, pavage, bords de chaussée, lignes médianes | `web/textures/sol_plan.jpg` | fourni |
| Ciel, nuages, ombres, points de téléportation au pied des bâtiments | `web/main.js` | fourni |
| Sources Blender (hologramme et maquette, version de travail du 23/09) | `blender/` | fourni |
| Sémantique du campus : bâtiments, étages, locaux | `web/donnees/campus_semantique.json` | fourni, partagé avec G1 |
| Fiches des bâtiments (rôle, histoire, pédagogie, services) | `web/donnees/fiches_batiments.json` | fourni, affiché et transmis à l'agent, partagé avec G1 |
| Scène three.js, vue orbitale, sélection, fiche du bâtiment | `web/main.js` | fourni |
| Agent par le relais (texte) | `web/main.js` et `relais/` | fourni, fonction didactique à écrire |
| Traces xAPI simplifiées | `tracer()` dans `web/main.js` | fourni, verbes à choisir |

## Ce qui n'y est pas, volontairement

La visite à la première personne, l'agent incarné et sa voix, le parcours, les missions, la
progression, l'évaluation et le débriefing : voir [`docs/A_CONSTRUIRE.md`](docs/A_CONSTRUIRE.md).

## Démarrer

1. Node 18 ou plus.
2. Copier `relais/env.exemple` en `relais/.env` et y coller la clé fournie par l'enseignant.
3. `node relais/serveur.mjs`, puis ouvrir `http://localhost:8787`.
   Le relais sert la page et répond à l'agent : la clé ne va jamais dans le navigateur.
4. Cliquer un bâtiment : sa fiche s'ouvre. Poser une question à l'agent.

Les bibliothèques three.js sont chargées depuis jsDelivr, version figée 0.169.0.

Pastilles orange au sol : un clic vous y téléporte à hauteur d'œil. « Retour à l'accueil »
revient à la vue d'ensemble. Sur un PC modeste, ouvrir `http://localhost:8787/?leger`
(sans ombres).

## Budget de polygones

La maquette d'origine (35 Mo, 2,3 millions de triangles affichés) a été décimée par
`outils/decimer.mjs` (gltf-transform, meshoptimizer) : arbres et mobilier fortement simplifiés,
bâtiments et sol préservés, textures limitées à 2048 px. Résultat : 0,85 million de triangles
affichés. Le sol ne dépend plus des UV du maillage : le plan est projeté depuis la position
(voir `outils/cuire_sol.py` pour le régénérer).

## L'agent IA : où tout se trouve

L'agent passe toujours par le relais : le client (casque ou navigateur) envoie une question et
un contexte, le relais ajoute la clé et les consignes, puis appelle OpenAI.

| Ce qui | Fichier | Ce que le groupe y fait |
|---|---|---|
| Appel à OpenAI, clé, modèle, plafonds | `relais/serveur.mjs` | rien en principe ; modèle et plafonds se règlent dans `relais/.env` |
| Clé et réglages (`OPENAI_API_KEY`, `OPENAI_MODEL`, `MAX_APPELS_JOUR`) | `relais/.env`, copié de `relais/env.exemple` | coller la clé ; jamais dans Git |
| **Instruction** de l'agent (message système) | `relais/consignes_agent.md` | **à réécrire** : rôle, ce qu'il dit, ce qu'il ne dit jamais, forme |
| Côté page : envoi de la question et affichage de la réponse | `web/main.js`, bloc « Agent » (`fetch('/api/chat')`) | brancher la voix, l'incarnation |
| **Connaissances** : bâtiment, étages, locaux | `web/donnees/campus_semantique.json` | enrichir ou filtrer |
| **Connaissances** : fiche du bâtiment et présentation du campus | `web/donnees/fiches_batiments.json` | vérifier, compléter |
| Assemblage du contexte envoyé à l'agent | `const contexte` dans `web/main.js`, bloc « Agent » | choisir ce que l'agent reçoit |
| Traces xAPI envoyées au relais | `tracer()` dans `web/main.js` | choisir les verbes |
| Journal des échanges et des traces | `relais/journal/*.jsonl` | lire pour l'évaluation et le débriefing |

Le relais relit `consignes_agent.md` à chaque question : une modification s'applique sans
redémarrer. Les connaissances ne sont pas « apprises » par le modèle : elles lui sont
transmises à chaque échange dans le contexte. Ce qui n'est pas dans le contexte, l'agent doit
dire qu'il ne le sait pas.

## Règles

- **La clé OpenAI reste dans `relais/.env`.** Jamais dans `web/`, Git ou une capture.
- Aucune donnée personnelle réelle dans les traces.
- Plafond d'appels par jour réglé dans `relais/.env` (`MAX_APPELS_JOUR`).
- L'agent annonce qu'il est une IA (AI Act, article 50).

## Structure

```
web/index.html, style.css, main.js   la page
web/modele/                          la maquette glTF décimée
web/textures/                        plan du sol et grains
outils/                              decimer.mjs, cuire_sol.py
web/donnees/                         la sémantique
relais/                              serveur.mjs, consignes_agent.md, env.exemple
blender/                             sources de la maquette
docs/A_CONSTRUIRE.md                 ce que le groupe conçoit
```

Le point d'entrée du travail est le gestionnaire de clic dans `web/main.js` : c'est là que la
sélection d'un bâtiment devient, ou non, une étape de parcours.
