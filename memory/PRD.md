# COURRIER - PRD

## Problème original
Jeu mobile simulant des vols vintage. 20 missions.

## Stack: Expo React Native, Zustand, React Native SVG

## Travaux complétés
- Collision AABB + corrections missions 1-19
- Mission RETOUR FRANCE (niveau 20) : carte, flèches, secteurs, collecte/distribution
- SARDEGNA: Tunisie secteur sud, aérodrome fixe
- Bug fixes: ATLANTIQUE, AMAZONIE fuel, BUENOS AIRES avion, GIBRALTAR II/AFRICA AGAIN télégrammes
- **Système i18n complet** : français/anglais avec 100+ traductions
  - Fichier: `src/i18n.tsx` (contexte React + AsyncStorage persistance)
  - Composants traduits: VintageDashboard, GameOverModal, MissionTelegram, HangarModal, EuropeMap, index.tsx, level.tsx, SettingsModal
  - Textes traduits: dashboard labels, télégrammes fin de mission, tutoriel, boutons, labels carte
  - Les noms de missions NE SONT PAS traduits (comme demandé par l'utilisateur)

## Backlog
- P2: Remplacer audio synthétisé par vrais fichiers audio
- P2: Refactoring gameStore.ts en modules
