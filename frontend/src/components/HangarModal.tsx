import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Image, ScrollView, Platform, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGameStore } from '../store/gameStore';
import { FuelGauge } from './dashboard/FuelGauge';
import { useI18n } from '../i18n';

interface HangarModalProps {
  visible: boolean;
  onClose: () => void;
  inMission?: boolean;
}

// Voyants d'alerte - mêmes couleurs que le tableau de bord
const warningColors = ['#4CAF50', '#FF9800', '#FF5722', '#F44336'];

const WarningLights: React.FC<{ warnings: number }> = ({ warnings }) => (
  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
    {warningColors.map((color, i) => (
      <View key={i} style={{
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: i < warnings ? color : '#2A2A1A',
        borderWidth: 2,
        borderColor: i < warnings ? color : '#555',
        shadowColor: i < warnings ? color : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: i < warnings ? 0.8 : 0,
        shadowRadius: 4,
      }} />
    ))}
  </View>
);

// Art Déco 1930s banner component - sans lignes horizontales
const ArtDecoBanner: React.FC<{ hangarText?: string }> = ({ hangarText }) => {
  return (
    <View style={styles.artDecoBanner}>
      <View style={styles.bannerContent}>
        {/* Logo left */}
        <Image
          source={require('../../assets/images/logo-hangar.png')}
          style={styles.bannerLogoSide}
          tintColor="#E8D5B0"
          resizeMode="contain"
        />
        
        {/* Center: Title + subtitle */}
        <View style={styles.bannerCenter}>
          <Text style={styles.bannerTitle}>HANGAR</Text>
          <Text style={styles.bannerSubtitle}>
            {hangarText || "UTILISEZ VOS MILES POUR RÉPARER\nVOTRE AVION ET REMPLIR LE RÉSERVOIR"}
          </Text>
        </View>
        
        {/* Logo right */}
        <Image
          source={require('../../assets/images/logo-hangar.png')}
          style={styles.bannerLogoSide}
          tintColor="#E8D5B0"
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

// Compteur MILES partagé
const MilesCounter: React.FC<{ totalMiles: number }> = ({ totalMiles }) => {
  const milesStr = String(totalMiles).padStart(6, '0');
  return (
    <View style={styles.milesContainer}>
      <Text style={styles.milesLabel}>MILES</Text>
      <View style={styles.milesDigits}>
        {milesStr.split('').map((digit, i) => (
          <View key={i} style={styles.digitBox}>
            <View style={styles.digitRollerBg} />
            <Text style={styles.digitText}>{digit}</Text>
            <View style={styles.digitShineTop} />
            <View style={styles.digitShineLine} />
            <View style={styles.digitShineBottom} />
          </View>
        ))}
      </View>
      <View style={styles.milesShine} />
    </View>
  );
};

export const HangarModal: React.FC<HangarModalProps> = ({ visible, onClose, inMission = false }) => {
  const { 
    totalMiles, fuelLevel, mechanicalWarnings, hangarRefuel, hangarRepair,
    plane2FuelLevel, plane2MechanicalWarnings, hangarRefuelPlane2, hangarRepairPlane2,
    currentLevelId,
  } = useGameStore();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const { t } = useI18n();
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  
  const isDualPlane = currentLevelId === 'patagonie' || currentLevelId === 'paraguay' || currentLevelId === 'sahel';
  
  useEffect(() => {
    if (visible) { setFeedbackMessage(null); }
  }, [visible]);

  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Handlers Avion 1
  const handleRefuel = () => {
    if (totalMiles < 10000) { setFeedbackType('error'); setFeedbackMessage('Miles insuffisants (10 000 requis)'); return; }
    if (fuelLevel >= 100) { setFeedbackType('error'); setFeedbackMessage('Réservoir Avion 1 déjà plein !'); return; }
    hangarRefuel(); setFeedbackType('success'); setFeedbackMessage('Avion 1 : +25L !');
  };
  const handleRepair = () => {
    if (totalMiles < 10000) { setFeedbackType('error'); setFeedbackMessage('Miles insuffisants (10 000 requis)'); return; }
    if (mechanicalWarnings <= 0) { setFeedbackType('error'); setFeedbackMessage('Avion 1 : aucune panne !'); return; }
    hangarRepair(); setFeedbackType('success'); setFeedbackMessage('Avion 1 : 1 panne réparée !');
  };

  // Handlers Avion 2
  const handleRefuelP2 = () => {
    if (totalMiles < 10000) { setFeedbackType('error'); setFeedbackMessage('Miles insuffisants (10 000 requis)'); return; }
    if (plane2FuelLevel >= 100) { setFeedbackType('error'); setFeedbackMessage('Réservoir Avion 2 déjà plein !'); return; }
    hangarRefuelPlane2(); setFeedbackType('success'); setFeedbackMessage('Avion 2 : +25L !');
  };
  const handleRepairP2 = () => {
    if (totalMiles < 10000) { setFeedbackType('error'); setFeedbackMessage('Miles insuffisants (10 000 requis)'); return; }
    if (plane2MechanicalWarnings <= 0) { setFeedbackType('error'); setFeedbackMessage('Avion 2 : aucune panne !'); return; }
    hangarRepairPlane2(); setFeedbackType('success'); setFeedbackMessage('Avion 2 : 1 panne réparée !');
  };
  
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <Image source={require('../../assets/images/hangar.png')} style={styles.bgImage} resizeMode="cover" />
        
        {/* Bandeau Art Déco vert foncé - tout en haut, pleine largeur */}
        <ArtDecoBanner hangarText={t('HANGAR_MODAL_TEXT')} />
        
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isDualPlane ? (
            /* ===== MODE 2 AVIONS ===== */
            <>
              {/* AVION 1 - partie haute */}
              <View style={styles.planeSection}>
                <Text style={styles.planeSectionTitle}>
                  <MaterialCommunityIcons name="airplane" size={14} color="#8B4513" /> AVION 1
                </Text>
                <View style={styles.buttonsRowSmall}>
                  <Pressable style={styles.actionButtonSmall} onPress={handleRefuel}>
                    <MaterialCommunityIcons name="gas-station" size={22} color="#FFFFFF" style={{ marginBottom: 4 }} />
                    <Text style={styles.actionLabelSmall}>CARBURANT</Text>
                    <Text style={styles.actionCostSmall}>10 000 miles</Text>
                    <Text style={styles.actionDetailSmall}>+25L</Text>
                    <View style={{ marginTop: 4 }}>
                      <FuelGauge gaugeSize={70} fuelLevel={fuelLevel} labelScale={0.5} />
                    </View>
                  </Pressable>
                  
                  <Pressable style={styles.actionButtonSmall} onPress={handleRepair}>
                    <MaterialCommunityIcons name="wrench" size={22} color="#FFFFFF" style={{ marginBottom: 4 }} />
                    <Text style={styles.actionLabelSmall}>RÉPARATION</Text>
                    <Text style={styles.actionCostSmall}>10 000 miles</Text>
                    <Text style={styles.actionDetailSmall}>-1 panne</Text>
                    <View style={{ marginTop: 4, height: 75, justifyContent: 'center', alignItems: 'center' }}>
                      <WarningLights warnings={mechanicalWarnings} />
                    </View>
                  </Pressable>
                </View>
              </View>

              {/* AVION 2 - partie basse */}
              <View style={styles.planeSection}>
                <Text style={[styles.planeSectionTitle, { color: '#1B4F72' }]}>
                  <MaterialCommunityIcons name="airplane" size={14} color="#1B4F72" /> AVION 2
                </Text>
                <View style={[styles.buttonsRowSmall, { width: '100%', paddingHorizontal: 10, justifyContent: 'center' }]}>
                  <Pressable style={[styles.actionButtonSmall, { alignItems: 'center' }]} onPress={handleRefuelP2}>
                    <MaterialCommunityIcons name="gas-station" size={22} color="#FFFFFF" style={{ marginBottom: 4 }} />
                    <Text style={styles.actionLabelSmall}>CARBURANT</Text>
                    <Text style={styles.actionCostSmall}>10 000 miles</Text>
                    <Text style={styles.actionDetailSmall}>+25L</Text>
                    <View style={{ marginTop: 4 }}>
                      <FuelGauge gaugeSize={70} fuelLevel={plane2FuelLevel} labelScale={0.5} />
                    </View>
                  </Pressable>
                  
                  <Pressable style={styles.actionButtonSmall} onPress={handleRepairP2}>
                    <MaterialCommunityIcons name="wrench" size={22} color="#FFFFFF" style={{ marginBottom: 4 }} />
                    <Text style={styles.actionLabelSmall}>RÉPARATION</Text>
                    <Text style={styles.actionCostSmall}>10 000 miles</Text>
                    <Text style={styles.actionDetailSmall}>-1 panne</Text>
                    <View style={{ marginTop: 4, height: 75, justifyContent: 'center', alignItems: 'center' }}>
                      <WarningLights warnings={plane2MechanicalWarnings} />
                    </View>
                  </Pressable>
                </View>
              </View>

              {/* MILES commun */}
              <MilesCounter totalMiles={totalMiles} />
            </>
          ) : (
            /* ===== MODE 1 AVION ===== */
            <>
              <View style={styles.buttonsRow}>
                <Pressable style={styles.actionButton} onPress={handleRefuel}>
                  <MaterialCommunityIcons name="gas-station" size={28} color="#FFFFFF" style={{ marginBottom: 4 }} />
                  <Text style={styles.actionLabel}>CARBURANT</Text>
                  <Text style={styles.actionCost}>10 000 miles</Text>
                  <Text style={styles.actionDetail}>+25L</Text>
                  <View style={{ marginTop: 6 }}>
                    <FuelGauge gaugeSize={90} fuelLevel={fuelLevel} labelScale={0.5} />
                  </View>
                </Pressable>
                
                <Pressable style={styles.actionButton} onPress={handleRepair}>
                  <MaterialCommunityIcons name="wrench" size={28} color="#FFFFFF" style={{ marginBottom: 4 }} />
                  <Text style={styles.actionLabel}>RÉPARATION</Text>
                  <Text style={styles.actionCost}>10 000 miles</Text>
                  <Text style={styles.actionDetail}>-1 panne</Text>
                  <View style={{ marginTop: 6, height: 108, justifyContent: 'center', alignItems: 'center' }}>
                    <WarningLights warnings={mechanicalWarnings} />
                  </View>
                </Pressable>
              </View>
              
              <MilesCounter totalMiles={totalMiles} />
            </>
          )}
          
          {/* Message de feedback */}
          {feedbackMessage ? (
            <View style={[styles.feedbackBadge, feedbackType === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
              <MaterialCommunityIcons name={feedbackType === 'success' ? 'check-circle' : 'alert-circle'} size={16} color={feedbackType === 'success' ? '#4CAF50' : '#FF6B6B'} />
              <Text style={[styles.feedbackText, feedbackType === 'error' && { color: '#FF6B6B' }]}>{feedbackMessage}</Text>
            </View>
          ) : (
            <View style={styles.feedbackPlaceholder} />
          )}
          
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>{t('FERMER')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  bgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, alignItems: 'center', width: '100%', flexGrow: 1 },
  
  // Art Déco Banner styles - pleine largeur, tout en haut, sans lignes horizontales
  artDecoBanner: { 
    width: '100%', 
    backgroundColor: '#1A3C2A', 
    overflow: 'hidden', 
    borderBottomWidth: 2, 
    borderBottomColor: '#C8B080',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 40,
    paddingBottom: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  bannerLogoSide: {
    width: 48,
    height: 48,
  },
  bannerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: '#E8D5B0',
    fontFamily: 'BigNoodleTitling',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 2,
  },
  bannerSubtitle: {
    color: '#C8B080',
    fontFamily: 'BigNoodleTitling',
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.8,
    lineHeight: 10,
    marginTop: -2,
  },
  
  // Mode 1 avion - taille normale
  buttonsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  actionButton: { backgroundColor: 'rgba(42,30,18,0.85)', borderRadius: 8, borderWidth: 1.5, borderColor: '#8B6914', paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', minWidth: 130 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(139,105,20,0.3)', borderWidth: 2, borderColor: '#8B6914', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  actionLabel: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  actionCost: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 9, marginBottom: 1 },
  actionDetail: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 10, fontWeight: 'bold' },

  // Mode 2 avions - 30% plus petits
  planeSection: { width: '100%', alignItems: 'center', marginBottom: 6 },
  planeSectionTitle: { 
    color: '#8B4513', fontFamily: 'BigNoodleTitling', fontSize: 13, fontWeight: 'bold', letterSpacing: 2, 
    marginBottom: 4, textAlign: 'center',
    backgroundColor: 'rgba(245,230,200,0.90)', paddingHorizontal: 16, paddingVertical: 3, borderRadius: 4,
    overflow: 'hidden', borderWidth: 1, borderColor: '#8B7355',
  },
  buttonsRowSmall: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignSelf: 'center', width: '100%', paddingHorizontal: 8 },
  actionButtonSmall: { backgroundColor: 'rgba(42,30,18,0.85)', borderRadius: 6, borderWidth: 1, borderColor: '#8B6914', paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center', width: '47%' },
  iconCircleSmall: { width: 29, height: 29, borderRadius: 15, backgroundColor: 'rgba(139,105,20,0.3)', borderWidth: 1.5, borderColor: '#8B6914', justifyContent: 'center', alignItems: 'center', marginBottom: 3 },
  actionLabelSmall: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 8, fontWeight: 'bold', marginBottom: 1 },
  actionCostSmall: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 7, marginBottom: 1 },
  actionDetailSmall: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 7, fontWeight: 'bold' },

  // Miles counter
  milesContainer: { backgroundColor: '#0D0D0D', borderRadius: 8, borderWidth: 2.5, borderColor: '#8B6914', paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', marginBottom: 8, position: 'relative', overflow: 'hidden', width: 270, alignSelf: 'center' },
  milesShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.07)', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  milesLabel: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 10, fontWeight: 'bold', marginBottom: 4, letterSpacing: 3 },
  milesDigits: { flexDirection: 'row' },
  digitBox: { backgroundColor: '#1A1A1A', borderRadius: 4, borderWidth: 1.5, borderTopColor: '#222', borderLeftColor: '#222', borderRightColor: '#555', borderBottomColor: '#555', paddingHorizontal: 6, paddingVertical: 4, marginHorizontal: 1.5, position: 'relative', overflow: 'hidden' },
  digitRollerBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#111' },
  digitText: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 20, fontWeight: 'bold', zIndex: 2 },
  digitShineTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '35%', backgroundColor: 'rgba(255,255,255,0.10)', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  digitShineLine: { position: 'absolute', top: '48%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(139,105,20,0.4)' },
  digitShineBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%', backgroundColor: 'rgba(0,0,0,0.25)', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },

  // Feedback & close
  feedbackBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginBottom: 8 },
  feedbackPlaceholder: { height: 32, marginBottom: 8 },
  feedbackSuccess: { backgroundColor: 'rgba(50, 50, 50, 0.85)', borderWidth: 1, borderColor: 'rgba(76, 175, 80, 0.6)' },
  feedbackError: { backgroundColor: 'rgba(50, 50, 50, 0.85)', borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.6)' },
  feedbackText: { color: '#4CAF50', fontFamily: 'BigNoodleTitling', fontSize: 12, fontWeight: 'bold' },
  closeButton: { backgroundColor: 'rgba(139,105,20,0.6)', borderRadius: 6, borderWidth: 1.5, borderColor: '#FFD700', paddingVertical: 8, paddingHorizontal: 30 },
  closeText: { color: '#FFFFFF', fontFamily: 'BigNoodleTitling', fontSize: 14, fontWeight: 'bold', letterSpacing: 2 },
});
