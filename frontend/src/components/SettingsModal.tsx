import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Switch,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useI18n } from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SOUND_PREF_KEY = '@courrier_sound_enabled';

interface Props {
  visible: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<Props> = ({ visible, onClose, soundEnabled, onToggleSound }) => {
  const router = useRouter();
  const { lang, setLang, t } = useI18n();

  const handleToggleSound = async (value: boolean) => {
    onToggleSound(value);
    try {
      await AsyncStorage.setItem(SOUND_PREF_KEY, JSON.stringify(value));
    } catch (e) {
      console.log('Error saving sound preference:', e);
    }
  };

  const handleOpenRules = () => {
    onClose();
    setTimeout(() => router.push('/howtoplay'), 200);
  };

  const handleResetProgress = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const toRemove = keys.filter(k =>
        k === 'completed_levels' ||
        k.startsWith('best_') ||
        k.startsWith('freeplay_best_') ||
        k.startsWith('@courrier_progress') ||
        k.startsWith('mission_') ||
        k.startsWith('telegrams_seen')
      );
      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }
      setResetConfirm(false);
      onClose();
      // Force reload to refresh all UI states
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location && window.location.reload) {
          window.location.reload();
        } else {
          router.replace('/');
        }
      }, 100);
    } catch (e) {
      console.log('Error resetting progress:', e);
    }
  };

  const [resetConfirm, setResetConfirm] = React.useState(false);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.woodFrame}>
            {/* Header */}
            <View style={styles.header}>
              <MaterialCommunityIcons name="cog" size={20} color="#FFD700" />
              <Text style={styles.headerTitle}>{t('SETTINGS_TITLE')}</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color="#C4A882" />
              </Pressable>
            </View>

            <View style={styles.divider} />

            {/* Sound section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="volume-high" size={18} color="#C8A55A" />
                <Text style={styles.sectionTitle}>{t('SON')}</Text>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('MOTEUR_EFFETS')}</Text>
                <Switch
                  value={soundEnabled}
                  onValueChange={handleToggleSound}
                  trackColor={{ false: '#3A2818', true: '#8B6914' }}
                  thumbColor={soundEnabled ? '#FFD700' : '#6B5344'}
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* Language section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="translate" size={18} color="#C8A55A" />
                <Text style={styles.sectionTitle}>{t('LANGUE')}</Text>
              </View>
              <View style={styles.flagRow}>
                <Pressable
                  style={[styles.flagButton, lang === 'fr' && styles.flagButtonActive]}
                  onPress={() => setLang('fr')}
                >
                  <Text style={styles.flagEmoji}>🇫🇷</Text>
                  <Text style={[styles.flagLabel, lang === 'fr' && styles.flagLabelActive]}>Français</Text>
                </Pressable>
                <Pressable
                  style={[styles.flagButton, lang === 'en' && styles.flagButtonActive]}
                  onPress={() => setLang('en')}
                >
                  <Text style={styles.flagEmoji}>🇬🇧</Text>
                  <Text style={[styles.flagLabel, lang === 'en' && styles.flagLabelActive]}>English</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Rules section */}
            <View style={styles.section}>
              <Pressable style={styles.rulesButton} onPress={handleOpenRules}>
                <MaterialCommunityIcons name="book-open-variant" size={18} color="#FFD700" />
                <Text style={styles.rulesButtonText}>{t('VOIR_REGLES')}</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            {/* Reset section */}
            <View style={styles.section}>
              {!resetConfirm ? (
                <Pressable style={styles.resetButton} onPress={() => setResetConfirm(true)}>
                  <MaterialCommunityIcons name="restart" size={18} color="#FF6B6B" />
                  <Text style={styles.resetButtonText}>{lang === 'en' ? 'RESET PROGRESS' : 'RÉINITIALISER LA PROGRESSION'}</Text>
                </Pressable>
              ) : (
                <View>
                  <Text style={styles.resetWarn}>
                    {lang === 'en'
                      ? 'This will erase all completed missions and best scores. Continue?'
                      : 'Cela supprimera toutes les missions accomplies et tous les meilleurs scores. Continuer ?'}
                  </Text>
                  <View style={styles.resetActions}>
                    <Pressable style={[styles.resetCancel]} onPress={() => setResetConfirm(false)}>
                      <Text style={styles.resetCancelText}>{lang === 'en' ? 'CANCEL' : 'ANNULER'}</Text>
                    </Pressable>
                    <Pressable style={[styles.resetConfirm]} onPress={handleResetProgress}>
                      <Text style={styles.resetConfirmText}>{lang === 'en' ? 'CONFIRM' : 'CONFIRMER'}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Decorative screws */}
            <View style={[styles.cornerScrew, { top: 5, left: 5 }]}>
              <View style={styles.screwCrossH} /><View style={styles.screwCrossV} />
            </View>
            <View style={[styles.cornerScrew, { top: 5, right: 5 }]}>
              <View style={styles.screwCrossH} /><View style={styles.screwCrossV} />
            </View>
            <View style={[styles.cornerScrew, { bottom: 5, left: 5 }]}>
              <View style={styles.screwCrossH} /><View style={styles.screwCrossV} />
            </View>
            <View style={[styles.cornerScrew, { bottom: 5, right: 5 }]}>
              <View style={styles.screwCrossH} /><View style={styles.screwCrossV} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
  },
  woodFrame: {
    backgroundColor: '#4A3828',
    borderRadius: 8,
    borderWidth: 3,
    borderTopColor: '#6B5344',
    borderLeftColor: '#6B5344',
    borderRightColor: '#2A1A0A',
    borderBottomColor: '#2A1A0A',
    overflow: 'hidden',
    position: 'relative',
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  headerTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 4,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#6B5344',
    marginHorizontal: 8,
  },
  section: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#C8A55A',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 20, 10, 0.5)',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#5A4838',
  },
  settingLabel: {
    color: '#E8D5B0',
    fontSize: 13,
    fontFamily: 'BigNoodleTitling',
  },
  flagRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flagButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 20, 10, 0.5)',
    borderRadius: 6,
    padding: 12,
    borderWidth: 2,
    borderColor: '#5A4838',
  },
  flagButtonActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(139, 105, 20, 0.3)',
  },
  flagEmoji: {
    fontSize: 22,
  },
  flagLabel: {
    color: '#8B7355',
    fontSize: 12,
    fontFamily: 'BigNoodleTitling',
    fontWeight: 'bold',
  },
  flagLabelActive: {
    color: '#FFD700',
  },
  rulesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(139, 105, 20, 0.3)',
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: '#8B6914',
  },
  rulesButtonText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 2,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(120, 30, 30, 0.25)',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#8B3A3A',
  },
  resetButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 1.5,
  },
  resetWarn: {
    color: '#E8D5B0',
    fontSize: 12,
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  resetActions: {
    flexDirection: 'row',
    gap: 8,
  },
  resetCancel: {
    flex: 1,
    backgroundColor: 'rgba(30, 20, 10, 0.6)',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5A4838',
  },
  resetCancelText: {
    color: '#C8A55A',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 1.5,
  },
  resetConfirm: {
    flex: 1,
    backgroundColor: '#8B3A3A',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  resetConfirmText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    letterSpacing: 1.5,
  },
  cornerScrew: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B7B60',
    borderWidth: 0.8,
    borderColor: '#5C4033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screwCrossH: {
    position: 'absolute',
    width: 4.5,
    height: 1,
    backgroundColor: '#4A3828',
  },
  screwCrossV: {
    position: 'absolute',
    width: 1,
    height: 4.5,
    backgroundColor: '#4A3828',
  },
});
