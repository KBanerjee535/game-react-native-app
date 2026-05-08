import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useI18n } from '../i18n';
import { LEVELS } from '../data/levels';
import { LEVEL_MAP_IMAGES, DEFAULT_MAP_IMAGE } from '../data/levelImages';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  won: boolean;
  mailCount: number;
  mailTarget: number;
  currentLevelId: string;
  currentLevelName: string;
  gibraltarMailCollected: number;
  gameOverReason: 'fuel' | 'mechanical' | 'critical_timeout' | null;
  freeplayMode: string | null;
  mauritaniaMailCumul?: number;
  newlyCompletedLevel?: string | null;
  onReplayMission: () => void;
  onNextMission: () => void;
  onMenu: () => void;
}

// Messages télégraphiques pour JEU LIBRE (crash = fin de partie)
const getFreeplayLines = (reason: 'fuel' | 'mechanical' | 'critical_timeout' | null, score: number, bestScore: number, isNewRecord: boolean, t: (k: string) => string) => {
  const courriersWord = t('COURRIERS_LOWER') === 'mails' ? 'MAILS' : 'COURRIERS';
  const lines = [
    `${t('FELICITATIONS')}`.replace(' STOP', '') + ` ${score} ${courriersWord} STOP`,
  ];
  
  if (isNewRecord) {
    lines.push(t('lang') === 'en' ? 'NEW RECORD STOP' : 'NOUVEAU RECORD STOP');
  } else {
    lines.push(`RECORD : ${bestScore} ${courriersWord} STOP`);
  }
  
  return lines;
};

// Messages télégraphiques pour ECHEC
const getLoseLines = (reason: 'fuel' | 'mechanical' | 'critical_timeout' | null, mailCount: number, levelId: string, mauritaniaMailCumul: number, gibraltarMailCollected: number, t: (k: string) => string) => {
  const postOfficeLevels = ['mauritanie', 'andes', 'niveau_16', 'corsica', 'sardegna', 'afrique_nord', 'paraguay', 'retour_france'];
  const gibraltarLevels = ['gibraltar', 'atlantique', 'africa_again', 'gibraltar2'];
  const displayCount = postOfficeLevels.includes(levelId) ? mauritaniaMailCumul
    : (levelId === 'africa_again' || levelId === 'gibraltar2') ? mailCount
    : levelId === 'atlantique' ? gibraltarMailCollected
    : gibraltarLevels.includes(levelId) ? gibraltarMailCollected
    : levelId === 'atlantique2' ? mailCount
    : mailCount;
  const verb = (levelId === 'atlantique2' || levelId === 'gibraltar2' || levelId === 'africa_again') ? t('RESTANTS') 
    : levelId === 'atlantique' ? t('DISTRIBUES')
    : (postOfficeLevels.includes(levelId) || gibraltarLevels.includes(levelId)) ? t('LIVRES') 
    : t('COLLECTES');
  const courriersWord = t('COURRIERS_LOWER') === 'mails' ? 'MAILS' : 'COURRIERS';
  
  if (reason === 'fuel') {
    // AFRICA AGAIN : ne pas indiquer le nombre de courriers restants en cas de panne/crash
    if (levelId === 'africa_again') {
      return [
        t('RESERVOIR_VIDE'),
        t('AVION_PERDITION'),
        t('CRASH_CONFIRME'),
        t('MISSION_ECHOUEE'),
      ];
    }
    return [
      t('RESERVOIR_VIDE'),
      t('AVION_PERDITION'),
      t('CRASH_CONFIRME'),
      `${displayCount} ${courriersWord} ${verb} STOP`,
      t('MISSION_ECHOUEE'),
    ];
  } else if (reason === 'mechanical' || reason === 'critical_timeout') {
    // AFRICA AGAIN : ne pas indiquer le nombre de courriers restants en cas de panne/crash
    if (levelId === 'africa_again') {
      return [
        t('PANNE_MECANIQUE'),
        t('MOTEUR_HS'),
        t('CRASH_CONFIRME'),
        t('MISSION_ECHOUEE'),
      ];
    }
    return [
      t('PANNE_MECANIQUE'),
      t('MOTEUR_HS'),
      t('CRASH_CONFIRME'),
      `${displayCount} ${courriersWord} ${verb} STOP`,
      t('MISSION_ECHOUEE'),
    ];
  }
  return [
    t('CRASH_CONFIRME'),
    `${displayCount} ${courriersWord} ${verb} STOP`,
    t('MISSION_ECHOUEE'),
  ];
};

// Messages télégraphiques pour VICTOIRE
const getWinLines = (mailCount: number, levelName: string, levelId: string, gibraltarMailCollected: number, mauritaniaMailCumul: number, t: (k: string) => string) => {
  const courriersWord = t('COURRIERS_LOWER') === 'mails' ? 'MAILS' : 'COURRIERS';
  if (levelId === 'atlantique2') {
    return [
      `MISSION ${levelName} STOP`,
      t('MISSION_ACCOMPLIE'),
      `${mailCount} ${courriersWord} ${t('RESTANTS')} STOP`,
      t('FELICITATIONS'),
      t('AEROPOSTALE_SALUE'),
    ];
  }
  const gibraltarLevels = ['gibraltar', 'atlantique', 'africa_again', 'gibraltar2'];
  const postOfficeLevels = ['mauritanie', 'andes', 'niveau_16', 'corsica', 'sardegna', 'afrique_nord', 'paraguay', 'retour_france'];
  const displayCount = (levelId === 'africa_again' || levelId === 'gibraltar2') ? mailCount
    : gibraltarLevels.includes(levelId) ? gibraltarMailCollected 
    : postOfficeLevels.includes(levelId) ? mauritaniaMailCumul 
    : mailCount;
  const verb = (levelId === 'gibraltar2' || levelId === 'africa_again') ? t('RESTANTS') : (gibraltarLevels.includes(levelId) || postOfficeLevels.includes(levelId) ? t('DISTRIBUES') : t('COLLECTES'));
  return [
    `MISSION ${levelName} STOP`,
    t('MISSION_ACCOMPLIE'),
    `${displayCount} ${courriersWord} ${verb} STOP`,
    t('FELICITATIONS'),
    t('AEROPOSTALE_SALUE'),
  ];
};

const getMention = (won: boolean, reason: 'fuel' | 'mechanical' | 'critical_timeout' | null, t: (k: string) => string) => {
  if (won) return t('COURRIERS_LOWER') === 'mails' ? 'SUCCESS' : 'SUCCES';
  if (reason === 'fuel') return t('PANNE_ESSENCE');
  if (reason === 'mechanical') return t('COURRIERS_LOWER') === 'mails' ? 'MECHANICAL FAILURE' : 'PANNE MECANIQUE';
  if (reason === 'critical_timeout') return t('COURRIERS_LOWER') === 'mails' ? 'CRITICAL FAILURE' : 'PANNE CRITIQUE';
  return t('COURRIERS_LOWER') === 'mails' ? 'INCIDENT' : 'INCIDENT';
};

// Bouton style tableau de bord avec vis
const DashboardButton: React.FC<{
  onPress: () => void;
  icon?: string;
  showLogo?: boolean;
  label: string;
}> = ({ onPress, icon, showLogo, label }) => (
  <TouchableOpacity onPress={onPress} style={styles.dashButton}>
    {showLogo && (
      <Image
        source={require('../../assets/images/logo-courrier.png')}
        style={styles.dashButtonLogo}
        tintColor="#FFFFFF"
        resizeMode="contain"
      />
    )}
    {icon && (
      <MaterialCommunityIcons name={icon as any} size={20} color="#FFFFFF" />
    )}
    <View style={styles.dashButtonDivider} />
    <Text style={styles.dashButtonLabel}>{label}</Text>
    {/* Vis aux coins */}
    <View style={[styles.screw, { top: 3, left: 3 }]}>
      <View style={styles.screwH} /><View style={styles.screwV} />
    </View>
    <View style={[styles.screw, { top: 3, right: 3 }]}>
      <View style={styles.screwH} /><View style={styles.screwV} />
    </View>
    <View style={[styles.screw, { bottom: 3, left: 3 }]}>
      <View style={styles.screwH} /><View style={styles.screwV} />
    </View>
    <View style={[styles.screw, { bottom: 3, right: 3 }]}>
      <View style={styles.screwH} /><View style={styles.screwV} />
    </View>
  </TouchableOpacity>
);

export const GameOverModal: React.FC<Props> = ({
  visible,
  won,
  mailCount,
  mailTarget,
  currentLevelId,
  currentLevelName,
  gibraltarMailCollected,
  gameOverReason,
  freeplayMode,
  mauritaniaMailCumul = 0,
  newlyCompletedLevel = null,
  onReplayMission,
  onNextMission,
  onMenu,
}) => {
  const [typedLines, setTypedLines] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [freeplayBestScore, setFreeplayBestScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const { t } = useI18n();

  // Calculate freeplay score
  const freeplayScore = freeplayMode === 'andes' ? mauritaniaMailCumul : mailCount;

  // Freeplay storage key mapping
  const freeplayStorageKey = freeplayMode === 'europe' ? 'freeplay_best_europe'
    : freeplayMode === 'andes' ? 'freeplay_best_andes'
    : freeplayMode === 'patagonie_ii' ? 'freeplay_best_patagonie_ii'
    : null;

  // Load and save freeplay best score
  useEffect(() => {
    if (visible && freeplayMode && freeplayStorageKey) {
      (async () => {
        try {
          const stored = await AsyncStorage.getItem(freeplayStorageKey);
          const best = stored ? parseInt(stored, 10) : 0;
          setFreeplayBestScore(best);
          if (freeplayScore > best) {
            setIsNewRecord(true);
            await AsyncStorage.setItem(freeplayStorageKey, String(freeplayScore));
          } else {
            setIsNewRecord(false);
          }
        } catch (e) {
          console.log('Error with freeplay score:', e);
        }
      })();
    }
  }, [visible, freeplayMode]);

  // Detect first-time mission victory: newlyCompletedLevel is passed as prop from store

  // Déterminer les lignes du télégramme
  const textLines = freeplayMode
    ? getFreeplayLines(gameOverReason, freeplayScore, freeplayBestScore, isNewRecord, t)
    : won
    ? getWinLines(mailCount, currentLevelName, currentLevelId, gibraltarMailCollected, mauritaniaMailCumul, t)
    : getLoseLines(gameOverReason, mailCount, currentLevelId, mauritaniaMailCumul, gibraltarMailCollected, t);

  useEffect(() => {
    if (visible) {
      setTypedLines(0);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();

      // Animation de frappe des lignes
      for (let i = 0; i <= textLines.length; i++) {
        setTimeout(() => setTypedLines(i + 1), i * 400 + 300);
      }
    }
  }, [visible, won]);

  if (!visible) return null;

  const mention = freeplayMode ? (t('COURRIERS_LOWER') === 'mails' ? 'FREE PLAY' : 'JEU LIBRE') : getMention(won, gameOverReason, t);
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const heureStr = `${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;
  const headerRightText = freeplayMode ? (t('COURRIERS_LOWER') === 'mails' ? 'FINAL\nSCORE' : 'SCORE\nFINAL') : won ? (t('COURRIERS_LOWER') === 'mails' ? 'SUCCESS\nORDER' : 'ORDRE\nDE\nSUCCES') : (t('COURRIERS_LOWER') === 'mails' ? 'TRANSMISSION\nNOTICE' : 'INDICATIONS\nDE\nTRANSMISSION');
  const natureText = freeplayMode ? (t('COURRIERS_LOWER') === 'mails' ? 'FREE PLAY' : 'JEU LIBRE') : won ? (t('COURRIERS_LOWER') === 'mails' ? 'VICTORY' : 'VICTOIRE') : 'URGENT';
  const freeplayNames: Record<string, string> = { europe: 'EUROPE', andes: 'ANDES', patagonie_ii: 'PATAGONIE II' };
  const displayLevelName = freeplayMode ? (freeplayNames[freeplayMode] || 'JEU LIBRE') : currentLevelName;

  // Pour les missions à débloquer (campagne) en cas de victoire :
  // afficher l'image de victoire en fond + boutons uniquement (pas de télégramme)
  const isCampaignVictory = won && !freeplayMode;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Image de fond - bureau vintage OU image de victoire selon le contexte */}
        <Image
          source={isCampaignVictory
            ? require('../../assets/images/victory-bg.png')
            : require('../../assets/images/bureau-vintage.png')}
          style={styles.bgImage}
          resizeMode="cover"
        />

        {isCampaignVictory ? (
          /* Layout victoire campagne : MISSION ACCOMPLIE + vignette groupés au centre, boutons en bas */
          <View style={styles.victoryLayout}>
            <View style={styles.victoryContent}>
              <Text style={styles.victoryTitle} adjustsFontSizeToFit numberOfLines={1}>
                {t('COURRIERS_LOWER') === 'mails' ? 'MISSION COMPLETE' : 'MISSION ACCOMPLIE'}
              </Text>

              {/* Vignette de la mission suivante (uniquement 1ère victoire ET mission suivante nouvellement débloquée) */}
              {newlyCompletedLevel && newlyCompletedLevel === currentLevelId && (() => {
                const currentIdx = LEVELS.findIndex(l => l.id === currentLevelId);
                const nextLevel = currentIdx >= 0 ? LEVELS[currentIdx + 1] : null;
                if (!nextLevel) return null;
                if (nextLevel.id === 'europe_20' || nextLevel.id === 'europe_40') return null;
                const nextIdx = currentIdx + 1;
                const nextImg = LEVEL_MAP_IMAGES[nextLevel.id] || DEFAULT_MAP_IMAGE;
                const getDifficultyColor = (difficulty: any) => {
                  switch (difficulty) {
                    case 'easy': return '#4CAF50';
                    case 'medium': return '#FFC107';
                    case 'hard': return '#F44336';
                    default: return '#888';
                  }
                };
                const isMultiStarLevel = (nextLevel.id === 'atlantique' || nextLevel.id === 'atlantique2' || nextLevel.id === 'africa_again' || nextLevel.id === 'afrique_nord');
                return (
                  <View style={styles.victoryUnlockGroup}>
                    <Text style={styles.unlockSubtitle}>
                      {t('COURRIERS_LOWER') === 'mails' ? 'You unlocked the mission:' : 'Vous avez débloqué la mission :'}
                    </Text>
                    <View style={styles.unlockCardV2}>
                      <Image source={nextImg} style={styles.unlockCardV2Image} resizeMode="cover" />
                      <View style={styles.unlockCardV2Brighten} />
                      <View style={styles.unlockCardV2NumberBadge}>
                        <Text style={styles.unlockCardV2NumberText}>{nextIdx + 1}</Text>
                      </View>
                      <View style={styles.unlockCardV2StarContainer}>
                        <View style={styles.unlockCardV2StarBadge}>
                          <MaterialCommunityIcons name="star" size={16} color={getDifficultyColor(nextLevel.difficulty)} />
                          {isMultiStarLevel && (
                            <MaterialCommunityIcons name="star" size={16} color="#F44336" />
                          )}
                        </View>
                      </View>
                      <View style={styles.unlockCardV2InfoContainer}>
                        <View style={styles.unlockCardV2InfoBg}>
                          <Text style={styles.unlockCardV2LevelName} numberOfLines={2}>
                            {nextLevel.id === 'campagne_europe' ? 'CAMPAGNE\nEUROPE' :
                             nextLevel.id === 'niveau_16' ? 'CAMPAGNE\nSCANDINAVIE' :
                             nextLevel.name}
                          </Text>
                          <Text style={styles.unlockCardV2LevelSubtitle} numberOfLines={1}>
                            {nextLevel.available ? `${nextLevel.mailTarget} ${t('COURRIERS_LOWER')}` : nextLevel.subtitle}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>

            <View style={styles.victoryButtons}>
              <DashboardButton
                onPress={onReplayMission}
                icon="restart"
                label={t('REJOUER')}
              />
              <DashboardButton
                onPress={onNextMission}
                icon="arrow-right-bold"
                label={t('COURRIERS_LOWER') === 'mails' ? 'NEXT' : 'SUIVANTE'}
              />
              <DashboardButton
                onPress={onMenu}
                showLogo
                label={t('MENU')}
              />
            </View>
          </View>
        ) : (
        /* Contenu centré */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.contentWrapper}>
            <View style={styles.telegramPaper}>
              {/* En-tête */}
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerSmall}>N° {Math.floor(Math.random() * 900) + 100}</Text>
                </View>
                <View style={styles.headerCenter}>
                  <Text style={styles.headerSubtitle}>POSTES ET TÉLÉCOMMUNICATIONS</Text>
                  <Text style={styles.headerTitle}>TÉLÉGRAMME</Text>
                </View>
                <View style={styles.headerRight}>
                  <Text style={styles.headerSmallRight}>{headerRightText}</Text>
                </View>
              </View>

              <View style={styles.thickDivider} />

              {/* Ligne d'info */}
              <View style={styles.infoRow}>
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>NATURE</Text>
                  <Text style={styles.infoCellValue}>{natureText}</Text>
                </View>
                <View style={styles.infoCellDivider} />
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>ORIGINE</Text>
                  <Text style={styles.infoCellValue}>{displayLevelName}</Text>
                </View>
                <View style={styles.infoCellDivider} />
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>DATE</Text>
                  <Text style={styles.infoCellValue}>{dateStr}</Text>
                </View>
                <View style={styles.infoCellDivider} />
                <View style={styles.infoCell}>
                  <Text style={styles.infoCellLabel}>HEURE</Text>
                  <Text style={styles.infoCellValue}>{heureStr}</Text>
                </View>
                <View style={styles.infoCellDivider} />
                <View style={[styles.infoCell, { flex: 1.5 }]}>
                  <Text style={styles.infoCellLabel}>MENTIONS</Text>
                  <Text style={styles.infoCellValue}>{mention}</Text>
                </View>
              </View>

              <View style={styles.thickDivider} />

              {/* Adresse */}
              <View style={styles.sectionRow}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionLabelText}>ADRESSE :</Text>
                </View>
                <View style={styles.sectionContent}>
                  <Text style={styles.addressText}>DIRECTION GENERALE DE L'AEROPOSTALE</Text>
                  <Text style={styles.addressText}>PARIS</Text>
                </View>
              </View>

              <View style={styles.thinDivider} />

              {/* Texte */}
              <View style={styles.sectionRow}>
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionLabelText}>TEXTE :</Text>
                </View>
                <View style={styles.texteContent}>
                  {textLines.map((line, idx) => (
                    <Text
                      key={idx}
                      style={[
                        styles.telegramText,
                        idx >= typedLines && styles.hiddenText,
                      ]}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.thickDivider} />

              {/* Pied de page */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Nom et adresse de l'expéditeur : PILOTE COURRIER
                </Text>
                <Text style={styles.footerNote}>
                  (Ces indications ne sont taxées et transmises que sur la demande expresse de l'expéditeur)
                </Text>
              </View>
            </View>

            {/* Boutons sous le télégramme - même pour victoire et défaite */}
            {typedLines > textLines.length && (
              <View style={styles.buttonsContainer}>
                <DashboardButton
                  onPress={onReplayMission}
                  icon="restart"
                  label={t('REJOUER')}
                />
                {!freeplayMode && won && (
                  <DashboardButton
                    onPress={onNextMission}
                    icon="arrow-right-bold"
                    label={t('COURRIERS_LOWER') === 'mails' ? 'NEXT' : 'SUIVANTE'}
                  />
                )}
                <DashboardButton
                  onPress={onMenu}
                  showLogo
                  label={t('MENU')}
                />
              </View>
            )}
          </View>
        </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  victoryLayout: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  victoryContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  victoryTitleCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  victoryCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  victoryUnlockZone: {
    position: 'absolute',
    top: '58%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  victoryUnlockGroup: {
    marginTop: 32,
    alignItems: 'center',
  },
  victoryTitle: {
    color: '#FFFFFF',
    fontFamily: 'BigNoodleTitling',
    fontSize: 56,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  victoryButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 'auto',
  },
  unlockBlock: {
    marginTop: 28,
    alignItems: 'center',
  },
  unlockSubtitle: {
    color: '#FFFFFF',
    fontFamily: 'BigNoodleTitling',
    fontSize: 13,
    letterSpacing: 1.5,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  unlockCard: {
    width: 180,
    height: 110,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFD700',
    overflow: 'hidden',
    backgroundColor: '#2A2018',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  unlockCardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  unlockCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  unlockCardName: {
    color: '#FFFFFF',
    fontFamily: 'BigNoodleTitling',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
    paddingHorizontal: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  // === Vignette V2 identique à celle de level.tsx — 20% plus petite (170→136) ===
  unlockCardV2: {
    width: 136,
    height: 136,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  unlockCardV2Image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  unlockCardV2Brighten: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  unlockCardV2NumberBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(200, 165, 90, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C8A55A',
  },
  unlockCardV2NumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
  unlockCardV2StarContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  unlockCardV2StarBadge: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 1,
  },
  unlockCardV2InfoContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockCardV2InfoBg: {
    alignItems: 'center',
  },
  unlockCardV2LevelName: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 2,
    textAlign: 'center',
  },
  unlockCardV2LevelSubtitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    color: 'rgba(0,0,0,0.7)',
    marginTop: 2,
  },
  bgImage: {
    position: 'absolute',
    top: -50,
    left: -10,
    right: -10,
    bottom: -50,
    width: SCREEN_WIDTH + 20,
    height: SCREEN_HEIGHT + 100,
  },
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  contentWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    width: '100%',
  },
  // Télégramme
  telegramPaper: {
    backgroundColor: '#E8DCBE',
    borderWidth: 2,
    borderColor: '#5A4A35',
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#5A4A35',
  },
  headerLeft: {
    width: 50,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#5A4A35',
    justifyContent: 'center',
  },
  headerSmall: {
    fontSize: 7,
    color: '#3A2A1A',
    fontFamily: 'BigNoodleTitling',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  headerSubtitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#3A2A1A',
    letterSpacing: 1,
    fontFamily: 'BigNoodleTitling',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A0A00',
    letterSpacing: 5,
    fontFamily: 'BigNoodleTitling',
  },
  headerRight: {
    width: 65,
    padding: 3,
    borderLeftWidth: 1,
    borderLeftColor: '#5A4A35',
    justifyContent: 'center',
  },
  headerSmallRight: {
    fontSize: 5,
    color: '#5A4A35',
    textAlign: 'center',
    lineHeight: 8,
  },
  thickDivider: {
    height: 2,
    backgroundColor: '#5A4A35',
  },
  thinDivider: {
    height: 1,
    backgroundColor: '#8B7B65',
    marginHorizontal: 4,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 2,
    minHeight: 36,
  },
  infoCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCellDivider: {
    width: 1,
    backgroundColor: '#8B7B65',
  },
  infoCellLabel: {
    fontSize: 6,
    color: '#5A4A35',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  infoCellValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1A0A00',
    fontFamily: 'BigNoodleTitling',
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  sectionLabel: {
    width: 55,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  sectionLabelText: {
    fontSize: 8,
    color: '#5A4A35',
    fontFamily: 'BigNoodleTitling',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  sectionContent: {
    flex: 1,
    paddingLeft: 4,
  },
  addressText: {
    fontSize: 10,
    color: '#1A0A00',
    fontFamily: 'BigNoodleTitling',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  texteContent: {
    flex: 1,
    paddingLeft: 4,
    paddingVertical: 8,
    minHeight: 100,
  },
  telegramText: {
    fontSize: 13,
    color: '#1A0A00',
    fontFamily: 'BigNoodleTitling',
    fontWeight: 'bold',
    letterSpacing: 1,
    lineHeight: 22,
    textAlign: 'center',
  },
  hiddenText: {
    opacity: 0,
  },
  footer: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#8B7B65',
  },
  footerText: {
    fontSize: 7,
    color: '#5A4A35',
    fontFamily: 'BigNoodleTitling',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  footerNote: {
    fontSize: 6,
    color: '#8B7B65',
    fontFamily: 'BigNoodleTitling',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Boutons style tableau de bord
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  dashButton: {
    backgroundColor: '#3A2818',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 3,
    borderTopColor: '#6B5344',
    borderLeftColor: '#6B5344',
    borderRightColor: '#2A1A0A',
    borderBottomColor: '#2A1A0A',
    alignItems: 'center',
    position: 'relative',
    minWidth: 90,
  },
  dashButtonLogo: {
    width: 30,
    height: 30,
  },
  dashButtonDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#8B6914',
    marginVertical: 3,
    opacity: 0.6,
  },
  dashButtonLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 1.5,
  },
  // Vis aux coins
  screw: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B7B60',
    borderWidth: 0.5,
    borderColor: '#5C4033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screwH: {
    position: 'absolute',
    width: 3.5,
    height: 0.8,
    backgroundColor: '#4A3828',
  },
  screwV: {
    position: 'absolute',
    width: 0.8,
    height: 3.5,
    backgroundColor: '#4A3828',
  },
});
