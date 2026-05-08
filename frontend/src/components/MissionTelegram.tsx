import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
  Animated,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LevelDef } from '../data/levels';
import { useI18n } from '../i18n';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  level: LevelDef;
  onStart: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  backgroundImage?: any;
}

export const MissionTelegram: React.FC<Props> = ({ visible, level, onStart, onCancel, cancelLabel, backgroundImage }) => {
  const [typedLines, setTypedLines] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { t } = useI18n();

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
      const lines = level.telegramDescription;
      for (let i = 0; i <= lines.length; i++) {
        setTimeout(() => setTypedLines(i + 1), i * 400 + 300);
      }
    }
  }, [visible]);

  if (!visible) return null;

  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const heureStr = `${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Image de fond - bureau vintage */}
        <Image
          source={require('../../assets/images/telegram-bg.png')}
          style={styles.bgImage}
          resizeMode="cover"
        />

        <View style={styles.contentWrapper}>
          {/* Le télégramme */}
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
                <Text style={styles.headerSmallRight}>ORDRE{'\n'}DE{'\n'}MISSION</Text>
              </View>
            </View>

            <View style={styles.thickDivider} />

            {/* Ligne d'info */}
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>NATURE</Text>
                <Text style={styles.infoCellValue}>MISSION</Text>
              </View>
              <View style={styles.infoCellDivider} />
              <View style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>NIVEAU</Text>
                <Text style={styles.infoCellValue}>{level.name}</Text>
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
                <Text style={styles.infoCellLabel}>OBJECTIF</Text>
                <Text style={styles.infoCellValue}>{level.mailTarget} COURRIERS</Text>
              </View>
            </View>

            <View style={styles.thickDivider} />

            {/* Adresse */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>DEST. :</Text>
              </View>
              <View style={styles.sectionContent}>
                <Text style={styles.addressText}>{t('PILOTE_AEROPOSTALE')}</Text>
                <Text style={styles.addressText}>EN ATTENTE D'ORDRES</Text>
              </View>
            </View>

            <View style={styles.thinDivider} />

            {/* Texte du télégramme */}
            <View style={styles.sectionRow}>
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>TEXTE :</Text>
              </View>
              <View style={styles.texteContent}>
                {level.telegramDescription.map((line, idx) => (
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
                {/* Étoiles de difficulté */}
                {typedLines >= level.telegramDescription.length && (
                  <View style={styles.difficultyRow}>
                    {(() => {
                      const color = level.difficulty === 'easy' ? '#4CAF50' : level.difficulty === 'medium' ? '#FFC107' : '#F44336';
                      const count = level.difficulty === 'hard' ? 2 : 1;
                      return Array.from({ length: count }).map((_, i) => (
                        <Text key={i} style={[styles.difficultyStar, { color }]}>★</Text>
                      ));
                    })()}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.thickDivider} />

            {/* Pied de page */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Nom et adresse de l'expéditeur : DIRECTION GENERALE DE L'AEROPOSTALE - PARIS
              </Text>
              <Text style={styles.footerNote}>
                (Ces ordres sont transmis par voie télégraphique avec la plus haute priorité)
              </Text>
            </View>
          </View>

          {/* Boutons sous le télégramme */}
          {typedLines > level.telegramDescription.length && (
            <View style={styles.buttonsContainer}>
              <Pressable onPress={onStart} style={styles.dashButton} testID="telegram-decoller-btn" accessibilityRole="button">
                <Image
                  source={require('../../assets/images/logo-courrier.png')}
                  style={{ width: 24, height: 24 }}
                  tintColor="#FFFFFF"
                  resizeMode="contain"
                />
                <View style={styles.dashButtonDivider} />
                <Text style={styles.dashButtonLabel}>DÉCOLLER</Text>
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
              </Pressable>

              <Pressable onPress={onCancel} style={styles.dashButton}>
                <MaterialCommunityIcons name="arrow-left" size={22} color="#C4A882" />
                <View style={styles.dashButtonDivider} />
                <Text style={styles.dashButtonLabel}>{cancelLabel || t('RETOUR')}</Text>
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
              </Pressable>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
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
    minHeight: 80,
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
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
  },
  difficultyStar: {
    fontSize: 20,
    fontWeight: 'bold',
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
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 24,
  },
  dashButton: {
    backgroundColor: '#3A2818',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 3,
    borderTopColor: '#6B5344',
    borderLeftColor: '#6B5344',
    borderRightColor: '#2A1A0A',
    borderBottomColor: '#2A1A0A',
    alignItems: 'center',
    position: 'relative',
    minWidth: 110,
  },
  dashButtonDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#8B6914',
    marginVertical: 4,
    opacity: 0.6,
  },
  dashButtonLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 2,
  },
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
