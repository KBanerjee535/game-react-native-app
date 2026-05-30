import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Pressable,
  ScrollView,
  ImageBackground,
  Image,
  Dimensions,
  ImageSourcePropType,
} from 'react-native';
import { useI18n } from '../src/i18n';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { useGameStore } from '../src/store/gameStore';
import { LEVELS, LevelDef } from '../src/data/levels';
import { MissionTelegram } from '../src/components/MissionTelegram';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const StarIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill={color} stroke="#000" strokeWidth={0.5} />
  </Svg>
);

// Modes de jeu libre (3 missions accessibles depuis le bouton DÉCOLLER)
const FREEPLAY_MODES = [
  {
    id: 'europe',
    name: 'EUROPE',
    levelId: 'europe_20',
    image: require('../assets/images/europe-map-vintage-new.png'),
    storageKey: 'freeplay_best_europe',
    starColor: '#4CAF50',
  },
  {
    id: 'andes',
    name: 'ANDES',
    levelId: 'andes',
    image: require('../assets/images/andes-map-v3.png'),
    storageKey: 'freeplay_best_andes',
    starColor: '#FFD700',
  },
  {
    id: 'patagonie_ii',
    name: 'PATAGONIE II',
    levelId: 'patagonie',
    image: require('../assets/images/patagonie.png'),
    storageKey: 'freeplay_best_patagonie_ii',
    starColor: '#F44336',
  },
];

type TabKey = 'missions' | 'libres' | 'compagnie';

import { LEVEL_MAP_IMAGES, DEFAULT_MAP_IMAGE } from '../src/data/levelImages';

export default function LevelScreen() {
  const router = useRouter();
  const { startLevel, startTutorial } = useGameStore();
  const [selectedLevel, setSelectedLevel] = useState<LevelDef | null>(null);
  const [showTelegram, setShowTelegram] = useState(false);
  const [completedLevels, setCompletedLevels] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('libres');
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [selectedFreeplay, setSelectedFreeplay] = useState<typeof FREEPLAY_MODES[0] | null>(null);
  const [showFreeplayTelegram, setShowFreeplayTelegram] = useState(false);
  const [bestAirAtlante, setBestAirAtlante] = useState<number>(0);
  const [bestPacifikair, setBestPacifikair] = useState<number>(0);
  const [bestAirindiana, setBestAirindiana] = useState<number>(0);
  const [bestAntartikair, setBestAntartikair] = useState<number>(0);
  const [bestWorldwide, setBestWorldwide] = useState<number>(0);
  const { t } = useI18n();

  // Couleur de l'étoile de difficulté
  const getDifficultyColor = (difficulty: LevelDef['difficulty']) => {
    switch (difficulty) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FFC107';
      case 'hard': return '#F44336';
      default: return '#888';
    }
  };

  useEffect(() => {
    const loadCompleted = async () => {
      try {
        const data = await AsyncStorage.getItem('completed_levels');
        if (data) setCompletedLevels(JSON.parse(data));
      } catch (e) {}
    };
    loadCompleted();
  }, []);

  // Reload completed levels each time the page is focused
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const data = await AsyncStorage.getItem('completed_levels');
          if (data) setCompletedLevels(JSON.parse(data));
        } catch (e) {}
      })();
    }, [])
  );

  // Charger les meilleurs scores des missions libres
  const loadScores = React.useCallback(async () => {
    try {
      const scores: Record<string, number> = {};
      for (const mode of FREEPLAY_MODES) {
        const val = await AsyncStorage.getItem(mode.storageKey);
        if (val) scores[mode.id] = parseInt(val, 10);
      }
      setBestScores(scores);
      // Air Atlante best score
      const airVal = await AsyncStorage.getItem('best_air_atlante');
      setBestAirAtlante(airVal ? parseInt(airVal, 10) : 0);
      // Pacifikair best score
      const pacVal = await AsyncStorage.getItem('best_pacifikair');
      setBestPacifikair(pacVal ? parseInt(pacVal, 10) : 0);
      // Airindiana best score
      const indVal = await AsyncStorage.getItem('best_airindiana');
      setBestAirindiana(indVal ? parseInt(indVal, 10) : 0);
      // Antartikair best score
      const antVal = await AsyncStorage.getItem('best_antartikair');
      setBestAntartikair(antVal ? parseInt(antVal, 10) : 0);
      // Worldwide best score
      const wwcVal = await AsyncStorage.getItem('best_worldwide');
      setBestWorldwide(wwcVal ? parseInt(wwcVal, 10) : 0);
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadScores();
  }, [activeTab, loadScores]);

  // Reload scores chaque fois que la page est mise au premier plan
  useFocusEffect(
    React.useCallback(() => {
      loadScores();
    }, [loadScores])
  );

  const handleLevelPress = (level: LevelDef) => {
    if (!level.available) return;
    setSelectedLevel(level);
    setShowTelegram(true);
  };

  // === Logique de déblocage progressif des missions à débloquer ===
  // EUROPE 20 et EUROPE 30 toujours débloquées.
  // Les autres se débloquent quand la précédente (dans l'ordre LEVELS) est accomplie.
  const isLevelUnlocked = React.useCallback((level: LevelDef, index: number): boolean => {
    if (level.id === 'europe_20' || level.id === 'europe_30') return true;
    if (index === 0) return true;
    const prev = LEVELS[index - 1];
    if (!prev) return true;
    return completedLevels.includes(prev.id);
  }, [completedLevels]);

  // === Logique de déblocage progressif des compagnies ===
  // AIR ATLANTE toujours débloquée. Les autres se débloquent par seuils de courriers distribués.
  const isCompagnieUnlocked = (id: 'air_atlante' | 'pacifikair' | 'airindiana' | 'antartikair' | 'worldwide'): boolean => {
    switch (id) {
      case 'air_atlante': return true;
      case 'pacifikair': return bestAirAtlante >= 500;
      case 'airindiana': return bestPacifikair >= 1000;
      case 'antartikair': return bestAirindiana >= 1500;
      case 'worldwide': return bestAntartikair >= 2000;
      default: return false;
    }
  };
  const compagnieUnlockThreshold = (id: 'pacifikair' | 'airindiana' | 'antartikair' | 'worldwide'): { needed: number; current: number; from: string } => {
    switch (id) {
      case 'pacifikair': return { needed: 500, current: bestAirAtlante, from: 'AIR ATLANTE' };
      case 'airindiana': return { needed: 1000, current: bestPacifikair, from: 'PACIFIKAIR' };
      case 'antartikair': return { needed: 1500, current: bestAirindiana, from: 'AIR INDIANA' };
      case 'worldwide': return { needed: 2000, current: bestAntartikair, from: 'ANTARTIKAIR' };
    }
  };

  const handleStartLevel = () => {
    if (!selectedLevel) return;
    setShowTelegram(false);
    startLevel(selectedLevel.id, selectedLevel.mailTarget);
    router.back();
  };

  const handleCancelTelegram = () => {
    setShowTelegram(false);
    setSelectedLevel(null);
  };

  const handleFreeplaySelect = (mode: typeof FREEPLAY_MODES[0]) => {
    setSelectedFreeplay(mode);
    setShowFreeplayTelegram(true);
  };

  const handleFreeplayStart = () => {
    if (!selectedFreeplay) return;
    setShowFreeplayTelegram(false);
    useGameStore.setState({ freeplayMode: selectedFreeplay.id });
    startLevel(selectedFreeplay.levelId, 99999);
    router.replace('/');
  };

  return (
    <ImageBackground
      source={require('../assets/images/missions-bg.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.content}>
        {/* En-tête */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCenterTitle}>
            <Text style={styles.title} numberOfLines={2}>{t('PAGE_MISSIONS_TITLE')}</Text>
          </View>
        </View>

        {/* Onglets */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabButton, activeTab === 'libres' && styles.tabButtonActive]}
            onPress={() => setActiveTab('libres')}
          >
            <Text style={[styles.tabText, activeTab === 'libres' && styles.tabTextActive]}>
              {t('MISSIONS_LIBRES')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'missions' && styles.tabButtonActive]}
            onPress={() => setActiveTab('missions')}
          >
            <Text style={[styles.tabText, activeTab === 'missions' && styles.tabTextActive]}>
              {t('TAB_MISSIONS_LABEL')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'compagnie' && styles.tabButtonActive]}
            onPress={() => setActiveTab('compagnie')}
          >
            <Text style={[styles.tabText, activeTab === 'compagnie' && styles.tabTextActive]}>
              {t('TAB_COMPAGNIE_LABEL')}
            </Text>
          </Pressable>
        </View>

        {/* Sous-titre contextuel selon l'onglet actif + boutons RÈGLES/TUTO dans un cadre grisé */}
        <View style={styles.tabIntroFrame}>
          <Text style={styles.tabSubtitle}>
            {activeTab === 'missions' && t('TAB_SUB_MISSIONS')}
            {activeTab === 'libres' && t('TAB_SUB_LIBRES')}
            {activeTab === 'compagnie' && t('TAB_SUB_COMPAGNIE')}
          </Text>
          {(activeTab === 'missions' || activeTab === 'libres') && (
            <View style={styles.helperButtonsRowInFrame}>
              <Pressable
                style={styles.helperButton}
                onPress={() => router.push('/howtoplay')}
              >
                <MaterialCommunityIcons name="book-open-variant" size={18} color="#1A2F4A" />
                <Text style={styles.helperButtonText}>{t('REGLES')}</Text>
              </Pressable>
              <Pressable
                style={styles.helperButton}
                onPress={() => { startTutorial(); router.replace('/'); }}
              >
                <MaterialCommunityIcons name="play-circle-outline" size={18} color="#1A2F4A" />
                <Text style={styles.helperButtonText}>TUTO</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Contenu selon l'onglet actif */}
        {activeTab === 'missions' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.cardsGrid}
          showsVerticalScrollIndicator={false}
        >
          {LEVELS.map((level, index) => {
            const isCompleted = completedLevels.includes(level.id);
            const isLocked = !isLevelUnlocked(level, index);
            const mapImage = LEVEL_MAP_IMAGES[level.id] || DEFAULT_MAP_IMAGE;

            return (
              <Pressable
                key={level.id}
                style={({ pressed }) => [
                  styles.mapCard,
                  isLocked && styles.mapCardLocked,
                  pressed && !isLocked && styles.mapCardPressed,
                ]}
                onPress={() => !isLocked && handleLevelPress(level)}
                disabled={isLocked}
              >
                {/* Image de carte en fond */}
                <Image
                  source={mapImage}
                  style={styles.mapImage}
                  resizeMode="cover"
                />
                {/* Voile blanc pour éclaircir légèrement */}
                <View style={styles.brightenOverlay} />

                {/* Overlay sombre pour locked */}
                {isLocked && <View style={styles.lockedOverlay} />}

                {/* Numéro en haut à gauche */}
                <View style={[
                  styles.numberBadge,
                  isLocked && styles.numberBadgeLocked,
                ]}>
                  <Text style={[
                    styles.numberText,
                    isLocked && styles.numberTextLocked,
                  ]}>
                    {index + 1}
                  </Text>
                </View>

                {/* Étoile(s) difficulté en haut à droite */}
                <View style={styles.starContainer}>
                  <View style={styles.starBadge}>
                    <MaterialCommunityIcons
                      name="star"
                      size={16}
                      color={isLocked ? '#5A4A3A' : getDifficultyColor(level.difficulty)}
                    />
                    {(level.id === 'atlantique' || level.id === 'atlantique2' || level.id === 'africa_again' || level.id === 'afrique_nord') && (
                      <MaterialCommunityIcons
                        name="star"
                        size={16}
                        color={isLocked ? '#5A4A3A' : '#F44336'}
                      />
                    )}
                  </View>
                </View>

                {/* Cadenas en bas à droite pour les niveaux verrouillés */}
                {isLocked && (
                  <View style={styles.lockBottomRight}>
                    <MaterialCommunityIcons name="lock" size={22} color="#FFFFFF" />
                  </View>
                )}

                {/* Nom + sous-titre en bas */}
                <View style={styles.infoContainer}>
                  <View style={styles.infoBg}>
                    <Text style={[
                      styles.levelName,
                      isLocked && styles.levelNameLocked,
                    ]} numberOfLines={2}>
                      {level.id === 'campagne_europe' ? 'CAMPAGNE\nEUROPE' :
                     level.id === 'niveau_16' ? 'CAMPAGNE\nSCANDINAVIE' :
                     level.id === 'corsica' ? 'CORSICA' :
                     level.name}
                    </Text>
                    <Text style={[
                      styles.levelSubtitle,
                      isLocked && styles.levelSubtitleLocked,
                    ]} numberOfLines={1}>
                      {level.available ? `${level.mailTarget} ${t('COURRIERS_LOWER')}` : level.subtitle}
                    </Text>
                  </View>

                  {/* Badge ACCOMPLIE */}
                  {isCompleted && (
                    <View style={styles.accompliBadge}>
                      <MaterialCommunityIcons name="check-circle" size={10} color="#FFFFFF" />
                      <Text style={styles.accompliText}>ACCOMPLIE</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        )}

        {/* Onglet MISSIONS LIBRES */}
        {activeTab === 'libres' && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.cardsGrid}
            showsVerticalScrollIndicator={false}
          >
            {FREEPLAY_MODES.map((mode) => (
              <Pressable
                key={mode.id}
                style={({ pressed }) => [
                  styles.mapCard,
                  pressed && styles.mapCardPressed,
                ]}
                onPress={() => handleFreeplaySelect(mode)}
              >
                <Image source={mode.image} style={styles.mapImage} resizeMode="cover" />
                <View style={styles.brightenOverlay} />
                {/* Étoile difficulté */}
                <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 5 }}>
                  <StarIcon color={mode.starColor} size={20} />
                </View>
                {/* Nom */}
                <View style={styles.infoContainer}>
                  <View style={styles.infoBg}>
                    <Text style={styles.levelName} numberOfLines={2}>{mode.name}</Text>
                  </View>
                </View>
                {/* Best score */}
                <View style={styles.scoreContainer}>
                  <View style={styles.scoreBadge}>
                    <MaterialCommunityIcons name="trophy" size={12} color="#FFD700" />
                    <Text style={styles.scoreText}>
                      {bestScores[mode.id] != null ? `${bestScores[mode.id]}` : '- - -'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Onglet COMPAGNIE - vignettes avec déblocage progressif */}
        {activeTab === 'compagnie' && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.cardsGrid, { paddingTop: 30 }]}
            showsVerticalScrollIndicator={false}
          >
            {([
              { id: 'air_atlante' as const, route: '/compagnie', logo: require('../assets/images/air-atlante-logo.png'), best: bestAirAtlante },
              { id: 'pacifikair' as const, route: '/pacifikair', logo: require('../assets/images/pacifikair-logo.png'), best: bestPacifikair },
              { id: 'airindiana' as const, route: '/airindiana', logo: require('../assets/images/airindiana-logo.png'), best: bestAirindiana },
              { id: 'antartikair' as const, route: '/antartikair', logo: require('../assets/images/antartikair-logo.png'), best: bestAntartikair },
              { id: 'worldwide' as const, route: '/worldwide', logo: require('../assets/images/worldwide-logo.png'), best: bestWorldwide },
            ]).map(item => {
              const unlocked = isCompagnieUnlocked(item.id);
              const threshold = item.id !== 'air_atlante' ? compagnieUnlockThreshold(item.id as any) : null;
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.airAtlanteCard,
                    !unlocked && styles.mapCardLocked,
                    pressed && unlocked && styles.mapCardPressed,
                  ]}
                  onPress={() => unlocked && router.push(item.route as any)}
                  disabled={!unlocked}
                >
                  <Image
                    source={item.logo}
                    style={styles.airAtlanteImage}
                    resizeMode="contain"
                  />
                  {!unlocked && <View style={styles.lockedOverlay} />}
                  <View style={styles.airAtlanteBestBadge}>
                    <MaterialCommunityIcons name="trophy" size={14} color="#FFD700" />
                    <Text style={styles.airAtlanteBestText}>
                      {item.best > 0 ? item.best.toLocaleString() : '---'}
                    </Text>
                  </View>
                  {!unlocked && (
                    <View style={styles.lockBottomRight}>
                      <MaterialCommunityIcons name="lock" size={22} color="#FFFFFF" />
                    </View>
                  )}
                  {!unlocked && threshold && (
                    <View style={styles.compagnieUnlockHint}>
                      <Text style={styles.compagnieUnlockHintText}>
                        {threshold.current.toLocaleString()} / {threshold.needed.toLocaleString()}
                      </Text>
                      <Text style={styles.compagnieUnlockHintSub} numberOfLines={1}>
                        {t('COURRIERS_LOWER').toUpperCase()} • {threshold.from}
                      </Text>
                    </View>
                  )}
                  <View style={styles.airAtlanteTitleOverlay} />
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Popup Télégramme de mission */}
      {selectedLevel && (
        <MissionTelegram
          visible={showTelegram}
          level={selectedLevel}
          onStart={handleStartLevel}
          onCancel={handleCancelTelegram}
        />
      )}

      {/* Popup Télégramme mission libre */}
      {showFreeplayTelegram && selectedFreeplay && (
        <MissionTelegram
          visible={showFreeplayTelegram}
          level={{
            id: selectedFreeplay.levelId,
            name: selectedFreeplay.name,
            subtitle: 'Mission Libre',
            mailTarget: 99999,
            available: true,
            difficulty: 'medium' as const,
            telegramDescription: selectedFreeplay.id === 'andes' ? [
              `MISSION ${selectedFreeplay.name} STOP`,
              'MODE LIBRE STOP',
              'COLLECTEZ UN MAXIMUM DE COURRIERS STOP',
              "L'AVION COLLECTE 20 COURRIERS MAX STOP",
              'PASSAGE PAR LE COL POUR DISTRIBUER LES COURRIERS AU BUREAU DE POSTE STOP',
            ] : selectedFreeplay.id === 'patagonie_ii' ? [
              `MISSION ${selectedFreeplay.name} STOP`,
              'MODE LIBRE STOP',
              'COLLECTEZ UN MAXIMUM DE COURRIERS STOP',
              '2 AVIONS A GERER STOP',
            ] : [
              `MISSION ${selectedFreeplay.name} STOP`,
              'MODE LIBRE STOP',
              'COLLECTEZ UN MAXIMUM DE COURRIERS STOP',
            ],
          }}
          onStart={handleFreeplayStart}
          onCancel={() => { setShowFreeplayTelegram(false); setSelectedFreeplay(null); }}
          cancelLabel="MENU"
          backgroundImage={require('../assets/images/bureau-vintage.png')}
        />
      )}
    </ImageBackground>
  );
}

const CARD_SIZE = Math.min(SCREEN_WIDTH * 0.42, 170);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 6,
    paddingLeft: 64, // espace pour la flèche retour
    paddingRight: 16,
    width: '100%',
  },
  headerCenterTitle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTitleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  titleBar: {
    width: 30,
    height: 2,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 10,
    opacity: 0.6,
  },
  title: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  scrollView: {
    flex: 1,
  },
  // Onglets
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    gap: 4,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  tabButton: {
    flex: 1,
    minHeight: 50,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: 'rgba(20, 20, 20, 0.55)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(139, 115, 85, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#F0E1BE',
    borderColor: '#1A2F4A',
    marginBottom: -1, // overlap onto the frame's top border to merge into one zone
    zIndex: 2,
  },
  tabText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#1A2F4A',
  },
  tabSubtitleContainer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  tabIntroFrame: {
    marginHorizontal: 16,
    marginTop: -1,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F0E1BE',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: '#1A2F4A',
    alignItems: 'center',
  },
  helperButtonsRowInFrame: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSubtitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    color: '#1A2F4A',
    letterSpacing: 1,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.95,
  },
  centeredTitleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  headerSpacer: {
    flex: 1,
  },
  // Écran COMPAGNIE
  compagnieContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  // AIR ATLANTE vignette - 50% taille
  airAtlanteCard: {
    width: SCREEN_WIDTH * 0.42,
    height: SCREEN_WIDTH * 0.42,
    maxWidth: 180,
    maxHeight: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(135, 206, 250, 0.7)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    backgroundColor: '#F0E1BE',
  },
  airAtlanteImage: {
    width: '100%',
    height: '100%',
  },
  airAtlanteTitleOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  airAtlanteBestBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.6)',
  },
  airAtlanteBestText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 0.8,
  },
  airAtlanteCardTitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  compagnieCard: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 1.0,
    maxWidth: 360,
    maxHeight: 420,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  compagnieTitleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  compagnieCardTitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
    lineHeight: 28,
  },
  compagnieTitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  compagnieDesc: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  // Score badge (Missions Libres)
  scoreContainer: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  scoreText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardsGrid: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  helperButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0E1BE',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1A2F4A',
    gap: 6,
    minWidth: 110,
  },
  helperButtonText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 14,
    color: '#1A2F4A',
    letterSpacing: 1.5,
  },
  mapCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  mapCardLocked: {
    borderColor: 'rgba(60, 60, 60, 0.6)',
  },
  mapCardPressed: {
    opacity: 0.85,
    borderColor: '#FFD700',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  brightenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  // Numéro en haut à gauche
  numberBadge: {
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
  numberBadgeLocked: {
    backgroundColor: 'rgba(40, 30, 20, 0.7)',
    borderColor: '#3A2A1A',
  },
  numberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
  numberTextLocked: {
    color: '#5A4A3A',
  },
  // Étoile(s) en haut à droite
  starContainer: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  starBadge: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 1,
  },
  // Cadenas centré pour locked
  lockIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Cadenas en bas à droite
  lockBottomRight: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1.5,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Hint de progression sous le cadenas (compagnie verrouillée)
  compagnieUnlockHint: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    zIndex: 10,
  },
  compagnieUnlockHintText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 1,
  },
  compagnieUnlockHintSub: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 9,
    color: '#C4A882',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  // Infos centrées au milieu de la vignette
  infoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBg: {
    alignItems: 'center',
  },
  levelName: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 2,
    textAlign: 'center',
  },
  levelNameLocked: {
    color: '#5A4A3A',
  },
  levelSubtitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    color: 'rgba(0,0,0,0.7)',
    marginTop: 2,
  },
  levelSubtitleLocked: {
    color: '#3A2A1A',
  },
  accompliBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    gap: 3,
    marginTop: 4,
  },
  accompliText: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
