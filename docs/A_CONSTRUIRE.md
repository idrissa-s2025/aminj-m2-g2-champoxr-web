# Ce que le groupe P2 conçoit

Le socle montre une chaîne technique : afficher le campus, sélectionner un bâtiment, en
parler. Il ne fait rien apprendre. Les sept éléments ci-dessous sont ceux du dossier du
module ; chacun indique l'endroit du code où il se branche.

## 1. Objectif d'apprentissage

Qu'est-ce qui est appris à travers le dispositif, et comment le visiteur prend-il conscience
de l'évolution de son apprentissage ? Un portail informe ; une formation fait apprendre.

## 2. Parcours et progression

Visite libre, parcours guidé ou missions : choisir. Une vue à la première personne
(`PointerLockControls` de three.js) est une piste, pas une obligation. Point d'entrée : le
gestionnaire de clic de `web/main.js`.

## 3. Fonction didactique de l'agent

À écrire dans `relais/consignes_agent.md` et dans le moment où la page appelle `/api/chat`.

## 4. Incarnation et voix

Avatar, voix seule ou texte : un choix argumenté. Le relais fournit `POST /api/session-vocale`
(jeton éphémère pour l'API Realtime en WebRTC) ; la chaîne vocale reste à construire.

## 5. Traces

Choisir les verbes avant de développer : `a_selectionne` et `a_questionne` sont fournis.
Elles sont écrites dans `relais/journal/`.

## 6. Évaluation

Épreuves avant, après et différée ; questionnaires (SUS, MPS, ASAQ) ; lecture des traces.

## 7. Débriefing

Ce que le visiteur voit de son parcours à la fin.

## Contraintes du web

- Performance : la maquette pèse 35 Mo ; mesurer le chargement sur un ordinateur d'étudiant
  et sur un téléphone.
- Accessibilité : clavier, contraste, sous-titres si l'agent parle.

## Coordination avec P1

Même maquette, même `campus_semantique.json`. Toute correction de données se fait dans le
fichier commun et se signale à l'autre équipe.
