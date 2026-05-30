import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = '@courrier_language';

export type Language = 'fr' | 'en';

const translations = {
  fr: {
    // Dashboard
    COURRIER: 'COURRIER',
    MENU: 'MENU',
    HANGAR: 'HANGAR',
    REGLAGES: 'RÉGLAGES',
    MILES: 'MILES',
    ESSENCE: 'ESSENCE',
    CUMUL: 'CUMUL',
    SCORE: 'SCORE',
    AVION_1: 'AVION 1',
    AVION_2: 'AVION 2',
    // Settings
    SETTINGS_TITLE: 'RÉGLAGES',
    SON: 'SON',
    MOTEUR_EFFETS: 'Moteur & effets',
    LANGUE: 'LANGUE',
    REGLES: 'RÈGLES',
    VOIR_REGLES: 'VOIR LES RÈGLES',
    // Home
    DECOLLER: 'DÉCOLLER',
    MISSION: 'DÉCOLLER',
    MISSIONS: 'MISSIONS',
    MISSIONS_LIBRES: 'MISSIONS LIBRES',
    COMPAGNIE: 'COMPAGNIE',
    PAGE_MISSIONS_TITLE: 'CHOISISSEZ VOTRE\nMODE DE JEU',
    TAB_MISSIONS_LABEL: 'MISSIONS À DÉBLOQUER',
    TAB_COMPAGNIE_LABEL: 'COMPAGNIES À DÉVELOPPER',
    AIR_ATLANTE: 'AIR ATLANTE',
    COMPAGNIE_BIENTOT: 'BIENTÔT DISPONIBLE',
    COMPAGNIE_DESC: 'Une nouvelle aventure se prépare au sein de la Compagnie...',
    // Telegram
    RETOUR: 'RETOUR',
    PILOTE_AEROPOSTALE: "PILOTE DE L'AEROPOSTALE",
    PILOTE_COURRIER: 'PILOTE COURRIER',
    NOM_ADRESSE_EXPEDITEUR: "Nom et adresse de l'expéditeur",
    // Game over telegram lines
    MISSION_ACCOMPLIE: 'MISSION ACCOMPLIE STOP',
    RESERVOIR_VIDE: 'RESERVOIR VIDE STOP',
    AVION_PERDITION: 'AVION EN PERDITION STOP',
    CRASH_CONFIRME: 'CRASH CONFIRME STOP',
    MISSION_ECHOUEE: 'MISSION ECHOUEE STOP',
    PANNE_MECANIQUE: 'PANNE MECANIQUE FATALE STOP',
    MOTEUR_HS: 'MOTEUR HORS SERVICE STOP',
    FELICITATIONS: 'FELICITATIONS PILOTE STOP',
    AEROPOSTALE_SALUE: "L'AEROPOSTALE VOUS SALUE STOP",
    PANNE_ESSENCE: 'PANNE ESSENCE',
    // Verbs
    COURRIERS_COLLECTES: 'COURRIERS COLLECTES',
    COURRIERS_DISTRIBUES: 'COURRIERS DISTRIBUES',
    COURRIERS_LIVRES: 'COURRIERS LIVRES',
    COURRIERS_RESTANTS: 'COURRIERS RESTANTS',
    COLLECTES: 'COLLECTES',
    DISTRIBUES: 'DISTRIBUES',
    LIVRES: 'LIVRES',
    RESTANTS: 'RESTANTS',
    // Levels page
    PAGE_MISSIONS: 'MISSIONS',
    OBJECTIF: 'OBJECTIF',
    COURRIERS_LOWER: 'courriers',
    // Rules page
    PAGE_REGLES: 'RÈGLES DU JEU',
    COMMENT_JOUER: 'COMMENT JOUER',
    OBJECTIF_JEU: 'OBJECTIF DU JEU',
    OBJ_TEXT: 'Collectez et distribuez le courrier en pilotant votre avion à travers différentes missions.',
    CARBURANT: 'CARBURANT',
    CARBURANT_TEXT: "Surveillez votre jauge d'essence. Atterrissez sur les destinations ⛽ pour faire le plein.",
    VOYANTS: 'VOYANTS MÉCANIQUES',
    VOYANTS_TEXT: 'Les voyants rouges indiquent des problèmes mécaniques. Atterrissez sur les destinations 🔧 pour réparer.',
    HANGAR_TITLE: 'HANGAR',
    HANGAR_TEXT: 'Utilisez vos miles pour remplir le réservoir et réparer votre avion.',
    BUREAU_POSTE: 'BUREAU DE POSTE',
    POSTE_TEXT: 'Livrez vos courriers au bureau de poste pour augmenter votre cumul.',
    FLECHES: 'FLÈCHES DE NAVIGATION',
    FLECHES_TEXT: 'Les flèches rouges permettent de naviguer entre les secteurs de la carte.',
    // Buttons
    REJOUER: 'REJOUER',
    MISSION_SUIVANTE: 'MISSION SUIVANTE',
    QUITTER: 'QUITTER',
    // Sectors
    NORD: 'NORD',
    SUD: 'SUD',
    TUNISIE: 'TUNISIE',
    // Sardegna
    AERODROME: 'AÉRODROME',
    UTILISE: 'UTILISÉ',
    POSTE: 'POSTE',
    // Hangar
    HANGAR_MODAL_TEXT: 'UTILISEZ VOS MILES POUR RÉPARER\nVOTRE AVION ET REMPLIR LE RÉSERVOIR',
    REPARER: 'RÉPARER',
    RESERVOIR_PLEIN: 'RÉSERVOIR PLEIN',
    REMPLIR: 'REMPLIR',
    FERMER: 'FERMER',
    // Tutorial
    TUTO_COLLECTE: 'VOUS AVEZ COLLECTE 3 COURRIERS',
    TUTO_MILES: "VOS MILES S'ACCUMULENT",
    TUTO_RESERVOIR: 'VOTRE RESERVOIR SE VIDE CLIQUER SUR UNE DESTINATION ESSENCE',
    TUTO_HANGAR: 'CLIQUER SUR HANGAR POUR REMPLIR LE RESERVOIR ET REPARER VOTRE AVION',
    // Freeplay telegrams
    FREE_COLLECT_MAX: 'COLLECTEZ UN MAXIMUM DE COURRIERS STOP',
    FREE_AVION_20: "L'AVION COLLECTE 20 COURRIERS MAX STOP",
    FREE_COL_POSTE: 'PASSAGE PAR LE COL POUR DISTRIBUER LES COURRIERS AU BUREAU DE POSTE STOP',
    // Compagnie modes (AIR ATLANTE / PACIFIKAIR / AIR INDIANA / ANTARTIKAIR)
    COMP_DISTRIBUES: 'COLLECTÉS',
    COMP_CREER_LIGNE: 'CRÉER UNE LIGNE',
    COMP_PROLONGER: 'PROLONGER',
    COMP_ANNULER: 'ANNULER',
    COMP_OK: 'OK',
    COMP_COMPRIS: 'COMPRIS',
    COMP_AEROPORT_INTL: 'AÉROPORT INTL',
    COMP_MILES_SUFFIX: 'MILES',
    COMP_SELECT_1ST_DEST: 'Sélectionnez la 1ère destination',
    COMP_SELECT_2ND_DEST: 'Sélectionnez la 2ème destination',
    COMP_EXTEND_STEP1: '1/2 — Sélectionnez la ligne à prolonger',
    COMP_EXTEND_STEP2: "2/2 — Sélectionnez la destination (extension depuis l'extrémité la plus proche)",
    COMP_CARGO_PICK: 'Sélectionnez une ligne pour ajouter un avion CARGO (capacité 20)',
    COMP_HUB_PICK: 'Sélectionnez une destination à transformer en HUB (capacité 100)',
    COMP_INTL_PICK: 'Sélectionnez une destination à transformer en AÉROPORT INTERNATIONAL',
    COMP_INTL_CREATE: 'Sélectionnez une autre destination pour créer une ligne internationale (avec CARGO)',
    COMP_CROISEMENT_TITLE: 'CROISEMENT INTERDIT',
    COMP_CROISEMENT_DESC: 'Impossible de tracer cette ligne : elle croiserait un tracé existant.',
    COMP_DEST_RELIEE_TITLE: 'DESTINATION RELIÉE',
    COMP_DEST_LOCKED_MSG: 'Cette destination est déjà reliée à une ligne. Transformez-la en HUB pour la relier à plusieurs lignes.',
    COMP_CARGO_UNLOCKED_TITLE: 'CARGO DÉBLOQUÉ !',
    COMP_CARGO_UNLOCKED_DESC: 'Vous pouvez désormais ajouter un avion CARGO (capacité 20 courriers) sur une ligne existante.',
    COMP_HUB_UNLOCKED_TITLE: 'HUB DÉBLOQUÉ !',
    COMP_HUB_UNLOCKED_DESC: 'Transformez une destination en HUB : capacité augmentée à 100 courriers.',
    COMP_COST_LABEL: 'Coût :',
    COMP_CARGO_MAX_MSG: 'Limite de {n} avions CARGO atteinte.',
    COMP_HUB_MAX_MSG: 'Limite de {n} HUB atteinte.',
    COMP_INTL_MAX_MSG: 'Limite de {n} aéroports internationaux atteinte.',
    COMP_LINES_MAX_MSG: 'Limite de {n} lignes atteinte. Distribuez encore {r} courriers pour débloquer une ligne supplémentaire.',
    COMP_INSUFFICIENT_MILES: 'FONDS INSUFFISANTS',
    COMP_INSUFFICIENT_MILES_DESC: 'Vous n\'avez pas assez de MILES pour cette action.',
    COMP_GAME_OVER_LOST: 'PARTIE TERMINÉE',
    COMP_GAME_OVER_LOST_DESC: 'Une destination a dépassé sa capacité. La compagnie est en faillite.',
    COMP_QUITTER: 'QUITTER',
    COMP_REJOUER: 'REJOUER',
    COMP_GAMEOVER_TITLE: 'COMPAGNIE FERMÉE',
    COMP_GAMEOVER_TEXT: 'Une ville a accumulé trop de courriers !',
    // Level page tab subtitles
    TAB_SUB_MISSIONS: 'Accomplissez les missions et débloquez les missions suivantes',
    TAB_SUB_LIBRES: 'Collectez un maximum de courriers avec ces missions libres',
    TAB_SUB_COMPAGNIE: 'Gérez vos compagnies aériennes',
    TUTO: 'TUTO',
    CROSS_EUROPE_MODAL_DESC: 'Votra avion a croisé une route existante. Cela cause des dommages a votre avion. Une lumière s\'est allumée sur votre tableau de bord. Attention lorsque les 4 lumières sont allumées, il ne vous reste plus qu\'une minute ou alors rendez-vous au hangar pour réparation.',
  },
  en: {
    COURRIER: 'COURRIER',
    MENU: 'MENU',
    HANGAR: 'HANGAR',
    REGLAGES: 'SETTINGS',
    MILES: 'MILES',
    ESSENCE: 'FUEL',
    CUMUL: 'TOTAL',
    SCORE: 'SCORE',
    AVION_1: 'PLANE 1',
    AVION_2: 'PLANE 2',
    SETTINGS_TITLE: 'SETTINGS',
    SON: 'SOUND',
    MOTEUR_EFFETS: 'Engine & effects',
    LANGUE: 'LANGUAGE',
    REGLES: 'RULES',
    VOIR_REGLES: 'VIEW RULES',
    DECOLLER: 'TAKE OFF',
    MISSION: 'TAKE OFF',
    MISSIONS: 'MISSIONS',
    MISSIONS_LIBRES: 'FREE PLAY',
    COMPAGNIE: 'COMPANY',
    PAGE_MISSIONS_TITLE: 'CHOOSE YOUR\nGAME MODE',
    TAB_MISSIONS_LABEL: 'MISSIONS TO UNLOCK',
    TAB_COMPAGNIE_LABEL: 'COMPANIES TO DEVELOP',
    AIR_ATLANTE: 'AIR ATLANTE',
    COMPAGNIE_BIENTOT: 'COMING SOON',
    COMPAGNIE_DESC: 'A new adventure is being prepared for the Company...',
    RETOUR: 'BACK',
    PILOTE_AEROPOSTALE: 'AEROPOSTALE PILOT',
    PILOTE_COURRIER: 'MAIL PILOT',
    NOM_ADRESSE_EXPEDITEUR: 'Sender name and address',
    MISSION_ACCOMPLIE: 'MISSION ACCOMPLISHED STOP',
    RESERVOIR_VIDE: 'FUEL TANK EMPTY STOP',
    AVION_PERDITION: 'AIRCRAFT IN DISTRESS STOP',
    CRASH_CONFIRME: 'CRASH CONFIRMED STOP',
    MISSION_ECHOUEE: 'MISSION FAILED STOP',
    PANNE_MECANIQUE: 'FATAL MECHANICAL FAILURE STOP',
    MOTEUR_HS: 'ENGINE OUT OF SERVICE STOP',
    FELICITATIONS: 'CONGRATULATIONS PILOT STOP',
    AEROPOSTALE_SALUE: 'THE AEROPOSTALE SALUTES YOU STOP',
    PANNE_ESSENCE: 'FUEL FAILURE',
    COURRIERS_COLLECTES: 'MAILS COLLECTED',
    COURRIERS_DISTRIBUES: 'MAILS DELIVERED',
    COURRIERS_LIVRES: 'MAILS DELIVERED',
    COURRIERS_RESTANTS: 'MAILS REMAINING',
    COLLECTES: 'COLLECTED',
    DISTRIBUES: 'DELIVERED',
    LIVRES: 'DELIVERED',
    RESTANTS: 'REMAINING',
    PAGE_MISSIONS: 'MISSIONS',
    OBJECTIF: 'OBJECTIVE',
    COURRIERS_LOWER: 'mails',
    PAGE_REGLES: 'GAME RULES',
    COMMENT_JOUER: 'HOW TO PLAY',
    OBJECTIF_JEU: 'GAME OBJECTIVE',
    OBJ_TEXT: 'Collect and deliver mail by flying your airplane through different missions.',
    CARBURANT: 'FUEL',
    CARBURANT_TEXT: 'Watch your fuel gauge. Land on ⛽ destinations to refuel.',
    VOYANTS: 'WARNING LIGHTS',
    VOYANTS_TEXT: 'Red lights indicate mechanical problems. Land on 🔧 destinations to repair.',
    HANGAR_TITLE: 'HANGAR',
    HANGAR_TEXT: 'Use your miles to refuel and repair your airplane.',
    BUREAU_POSTE: 'POST OFFICE',
    POSTE_TEXT: 'Deliver your mail at the post office to increase your total.',
    FLECHES: 'NAVIGATION ARROWS',
    FLECHES_TEXT: 'Red arrows allow you to navigate between map sectors.',
    REJOUER: 'REPLAY',
    MISSION_SUIVANTE: 'NEXT MISSION',
    QUITTER: 'QUIT',
    NORD: 'NORTH',
    SUD: 'SOUTH',
    TUNISIE: 'TUNISIA',
    AERODROME: 'AIRFIELD',
    UTILISE: 'USED',
    POSTE: 'POST',
    HANGAR_MODAL_TEXT: 'USE YOUR MILES TO REPAIR\nYOUR PLANE AND REFUEL',
    REPARER: 'REPAIR',
    RESERVOIR_PLEIN: 'TANK FULL',
    REMPLIR: 'REFUEL',
    FERMER: 'CLOSE',
    TUTO_COLLECTE: 'YOU COLLECTED 3 MAILS',
    TUTO_MILES: 'YOUR MILES ARE ADDING UP',
    TUTO_RESERVOIR: 'YOUR TANK IS EMPTYING TAP ON A FUEL DESTINATION',
    TUTO_HANGAR: 'TAP HANGAR TO REFUEL AND REPAIR YOUR PLANE',
    FREE_COLLECT_MAX: 'COLLECT AS MANY MAILS AS POSSIBLE STOP',
    FREE_AVION_20: 'PLANE CARRIES 20 MAILS MAX STOP',
    FREE_COL_POSTE: 'FLY THROUGH THE PASS TO DELIVER MAILS TO THE POST OFFICE STOP',
    // Compagnie modes (AIR ATLANTE / PACIFIKAIR / AIR INDIANA / ANTARTIKAIR)
    COMP_DISTRIBUES: 'COLLECTED',
    COMP_CREER_LIGNE: 'CREATE A LINE',
    COMP_PROLONGER: 'EXTEND',
    COMP_ANNULER: 'CANCEL',
    COMP_OK: 'OK',
    COMP_COMPRIS: 'GOT IT',
    COMP_AEROPORT_INTL: 'INTL AIRPORT',
    COMP_MILES_SUFFIX: 'MILES',
    COMP_SELECT_1ST_DEST: 'Select the 1st destination',
    COMP_SELECT_2ND_DEST: 'Select the 2nd destination',
    COMP_EXTEND_STEP1: '1/2 — Select the line to extend',
    COMP_EXTEND_STEP2: '2/2 — Select the destination (extension from nearest endpoint)',
    COMP_CARGO_PICK: 'Select a line to add a CARGO plane (capacity 20)',
    COMP_HUB_PICK: 'Select a destination to upgrade into a HUB (capacity 100)',
    COMP_INTL_PICK: 'Select a destination to upgrade into an INTERNATIONAL AIRPORT',
    COMP_INTL_CREATE: 'Select another destination to create an international line (with CARGO)',
    COMP_CROISEMENT_TITLE: 'CROSSING FORBIDDEN',
    COMP_CROISEMENT_DESC: 'Cannot draw this line: it would cross an existing route.',
    COMP_DEST_RELIEE_TITLE: 'DESTINATION LINKED',
    COMP_DEST_LOCKED_MSG: 'This destination is already on a line. Upgrade it to a HUB to connect multiple lines.',
    COMP_CARGO_UNLOCKED_TITLE: 'CARGO UNLOCKED!',
    COMP_CARGO_UNLOCKED_DESC: 'You can now add a CARGO plane (capacity 20 mails) on an existing line.',
    COMP_HUB_UNLOCKED_TITLE: 'HUB UNLOCKED!',
    COMP_HUB_UNLOCKED_DESC: 'Upgrade a destination into a HUB: capacity raised to 100 mails.',
    COMP_COST_LABEL: 'Cost:',
    COMP_CARGO_MAX_MSG: 'CARGO planes limit reached ({n}).',
    COMP_HUB_MAX_MSG: 'HUB limit reached ({n}).',
    COMP_INTL_MAX_MSG: 'International airports limit reached ({n}).',
    COMP_LINES_MAX_MSG: 'Lines limit reached ({n}). Deliver {r} more mails to unlock another line.',
    COMP_INSUFFICIENT_MILES: 'INSUFFICIENT FUNDS',
    COMP_INSUFFICIENT_MILES_DESC: 'You do not have enough MILES for this action.',
    COMP_GAME_OVER_LOST: 'GAME OVER',
    COMP_GAME_OVER_LOST_DESC: 'A destination exceeded its capacity. The company is bankrupt.',
    COMP_QUITTER: 'QUIT',
    COMP_REJOUER: 'REPLAY',
    COMP_GAMEOVER_TITLE: 'COMPANY CLOSED',
    COMP_GAMEOVER_TEXT: 'A city has accumulated too much mail!',
    // Level page tab subtitles
    TAB_SUB_MISSIONS: 'Complete missions and unlock the next ones',
    TAB_SUB_LIBRES: 'Collect as many mails as possible in these free missions',
    TAB_SUB_COMPAGNIE: 'Manage your airline companies',
    TUTO: 'TUTO',
    CROSS_EUROPE_MODAL_DESC: 'Your plane crossed an existing road. This is causing damage to your plane. A light has turned on on your dashboard. Be careful when all 4 lights are on, you only have one minute left or else go to the hangar for repairs.',
  },
} as const;

type TranslationKey = keyof typeof translations.fr;

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (key) => translations.fr[key] || key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>('fr');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(stored => {
      if (stored === 'en' || stored === 'fr') setLangState(stored);
    }).catch(() => {});
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    AsyncStorage.setItem(LANG_KEY, newLang).catch(() => {});
  };

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations.fr[key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
