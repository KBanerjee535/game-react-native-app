import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGameStore } from '../src/store/gameStore';

import { MissionTelegram } from '../src/components/MissionTelegram';

import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const StarIcon = ({ color, size = 22 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill={color} stroke="#000" strokeWidth={0.5} />
  </Svg>
);

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

export default function FreeplayScreen() {
  const router = useRouter();
  const startLevel = useGameStore((s) => s.startLevel);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [selectedMode, setSelectedMode] = useState<typeof FREEPLAY_MODES[0] | null>(null);
  const [showStartTelegram, setShowStartTelegram] = useState(false);

  useEffect(() => {
    loadBestScores();
  }, []);

  const loadBestScores = async () => {
    try {
      const scores: Record<string, number> = {};
      for (const mode of FREEPLAY_MODES) {
        const val = await AsyncStorage.getItem(mode.storageKey);
        if (val) scores[mode.id] = parseInt(val, 10);
      }
      setBestScores(scores);
    } catch (e) {
      console.log('Error loading freeplay scores:', e);
    }
  };

  const handleSelectMode = (mode: typeof FREEPLAY_MODES[0]) => {
    setSelectedMode(mode);
    setShowStartTelegram(true);
  };

  const handleStartAfterTelegram = () => {
    if (!selectedMode) return;
    setShowStartTelegram(false);
    useGameStore.setState({ freeplayMode: selectedMode.id });
    startLevel(selectedMode.levelId, 99999);
    router.replace('/');
  };

  return (
    <ImageBackground
      source={require('../assets/images/freeplay-bg.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      {/* Léger overlay pour lisibilité */}
      <View style={styles.overlay} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleArea}>
            <View style={styles.titleBar} />
            <Text style={styles.headerTitle}>MISSIONS LIBRES</Text>
            <View style={styles.titleBar} />
          </View>
          <Text style={styles.headerSubtitle}>Volez sans limite — battez votre record !</Text>
        </View>

        {/* Map Cards - colonne verticale */}
        <View style={styles.cardsContainer}>
          {FREEPLAY_MODES.map((mode) => (
            <Pressable
              key={mode.id}
              style={({ pressed }) => [
                styles.mapCard,
                pressed && styles.mapCardPressed,
              ]}
              onPress={() => handleSelectMode(mode)}
            >
              {/* Map Image */}
              <Image
                source={mode.image}
                style={styles.mapImage}
                resizeMode="cover"
              />
              {/* Voile blanc pour éclaircir légèrement */}
              <View style={styles.brightenOverlay} />
              {/* Étoile de difficulté en haut à droite */}
              <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
                <StarIcon color={mode.starColor} size={24} />
              </View>
              {/* Label - texte noir sans cadre grisé */}
              <View style={styles.mapLabelContainer}>
                <Text style={styles.mapLabel}>{mode.name}</Text>
              </View>
              {/* Best score */}
              <View style={styles.scoreContainer}>
                <View style={styles.scoreBadge}>
                  <MaterialCommunityIcons name="trophy" size={13} color="#FFD700" />
                  <Text style={styles.scoreText}>
                    {bestScores[mode.id] != null ? `${bestScores[mode.id]}` : '- - -'}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Télégramme de début de mission libre */}
      {showStartTelegram && selectedMode && (
        <MissionTelegram
          visible={showStartTelegram}
          level={{
            id: selectedMode.levelId,
            name: selectedMode.name,
            subtitle: 'Mission Libre',
            mailTarget: 99999,
            available: true,
            difficulty: 'medium' as const,
            telegramDescription: selectedMode.id === 'andes' ? [
              `MISSION ${selectedMode.name} STOP`,
              'MODE LIBRE STOP',
              'COLLECTEZ UN MAXIMUM DE COURRIERS STOP',
              "L'AVION COLLECTE 20 COURRIERS MAX STOP",
              'PASSAGE PAR LE COL POUR DISTRIBUER LES COURRIERS AU BUREAU DE POSTE STOP',
            ] : selectedMode.id === 'patagonie_ii' ? [
              `MISSION ${selectedMode.name} STOP`,
              'MODE LIBRE STOP',
              'COLLECTEZ UN MAXIMUM DE COURRIERS STOP',
              '2 AVIONS A GERER STOP',
            ] : [
              `MISSION ${selectedMode.name} STOP`,
              'MODE LIBRE STOP',
              'COLLECTEZ UN MAXIMUM DE COURRIERS STOP',
            ],
          }}
          onStart={handleStartAfterTelegram}
          onCancel={() => { setShowStartTelegram(false); setSelectedMode(null); }}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 16,
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 50,
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
  headerTitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  headerSubtitle: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 6,
    fontStyle: 'italic',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  cardsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 12,
    gap: 14,
    paddingHorizontal: 16,
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
  mapLabelContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapLabelBg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  mapLabel: {
    fontFamily: 'BigNoodleTitling',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1A1A',
    letterSpacing: 2,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
});
