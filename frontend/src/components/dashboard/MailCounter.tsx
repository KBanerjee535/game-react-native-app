import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  mailCount: number;
  mailTarget: number;
  counterWidth: number;
  gibraltarPhase?: 1 | 2 | null;
  mauritaniaCumul?: number;
  isMauritanie?: boolean;
  isFreeplay?: boolean;
}

export const MailCounter: React.FC<Props> = ({ mailCount, mailTarget, counterWidth, gibraltarPhase, mauritaniaCumul, isMauritanie, isFreeplay }) => {
  const formattedMailCount = mailCount.toString().padStart(2, '0');
  const formattedCumul = String(mauritaniaCumul ?? 0).padStart(2, '0');
  
  // Texte du label et objectif selon la phase
  const label = isFreeplay ? 'SCORE' : gibraltarPhase === 2 ? 'DISTRIBUER' : isMauritanie ? 'AVION' : 'COURRIER';
  const targetText = isFreeplay ? '' : gibraltarPhase === 2 ? '→ 0' : isMauritanie ? '/20' : `/${mailTarget}`;

  // En mode Mauritanie, on affiche 2 compteurs côte à côte
  if (isMauritanie) {
    return (
      <View style={styles.dualCounterRow}>
        {/* Compteur AVION (courriers à bord) */}
        <View style={styles.compactFrame}>
          <View style={styles.counterTopPlate}>
            <Text style={styles.compactLabel}>AVION</Text>
          </View>
          <View style={styles.compactBody}>
            <View style={styles.compactRollerContainer}>
              <View style={styles.compactRollerDigit}>
                <Text style={styles.compactRollerText}>{formattedMailCount[0]}</Text>
              </View>
              <View style={styles.rollerSeparator} />
              <View style={styles.compactRollerDigit}>
                <Text style={styles.compactRollerText}>{formattedMailCount[1]}</Text>
              </View>
            </View>
            <View style={styles.compactGlassReflection} />
          </View>
          <View style={styles.compactBottomPlate}>
            <Text style={styles.compactTarget}>/20</Text>
          </View>
          {/* Screws */}
          <View style={[styles.miniScrew, { top: 3, left: 3 }]}><View style={styles.miniScrewH} /><View style={styles.miniScrewV} /></View>
          <View style={[styles.miniScrew, { top: 3, right: 3 }]}><View style={styles.miniScrewH} /><View style={styles.miniScrewV} /></View>
          <View style={[styles.miniScrew, { bottom: 3, left: 3 }]}><View style={styles.miniScrewH} /><View style={styles.miniScrewV} /></View>
          <View style={[styles.miniScrew, { bottom: 3, right: 3 }]}><View style={styles.miniScrewH} /><View style={styles.miniScrewV} /></View>
        </View>

        {/* Compteur CUMUL (courriers distribués) */}
        <View style={[styles.compactFrame, styles.cumulFrameGold]}>
          <View style={styles.cumulTopPlateGold}>
            <Text style={styles.compactLabelGold}>CUMUL</Text>
          </View>
          <View style={styles.compactBody}>
            <View style={styles.compactRollerContainer}>
              <View style={styles.compactRollerDigit}>
                <Text style={styles.compactRollerTextGold}>{formattedCumul[0]}</Text>
              </View>
              <View style={styles.rollerSeparator} />
              <View style={styles.compactRollerDigit}>
                <Text style={styles.compactRollerTextGold}>{formattedCumul[1]}</Text>
              </View>
            </View>
            <View style={styles.compactGlassReflection} />
          </View>
          <View style={styles.compactBottomPlate}>
            <Text style={styles.cumulTargetGold}>/{mailTarget}</Text>
          </View>
          {/* Screws */}
          <View style={[styles.miniScrew, { top: 3, left: 3 }]}><View style={styles.miniScrewH} /><View style={styles.miniScrewV} /></View>
          <View style={[styles.miniScrew, { top: 3, right: 3 }]}><View style={styles.miniScrewH} /><View style={styles.miniScrewV} /></View>
          <View style={[styles.miniScrew, { bottom: 3, left: 3 }]}><View style={styles.miniScrewH} /><View style={styles.miniScrewV} /></View>
          <View style={[styles.miniScrew, { bottom: 3, right: 3 }]}><View style={styles.miniScrewH} /><View style={styles.miniScrewV} /></View>
        </View>
      </View>
    );
  }

  // Mode normal (non-Mauritanie) : un seul compteur
  return (
    <View style={[styles.counterContainer, { width: counterWidth }]}>
      <View style={styles.vintageCounterFrame}>
        {/* Decorative top plate */}
        <View style={[styles.counterTopPlate, gibraltarPhase === 2 && styles.counterTopPlateDelivery]}>
          <Text style={styles.vintageCounterLabel}>{label}</Text>
        </View>
        
        {/* Main counter body */}
        <View style={styles.counterBody}>
          {/* Roller display */}
          <View style={styles.vintageRollerContainer}>
            <View style={styles.vintageRollerDigit}>
              <Text style={styles.vintageRollerText}>{formattedMailCount[0]}</Text>
            </View>
            <View style={styles.rollerSeparator} />
            <View style={styles.vintageRollerDigit}>
              <Text style={styles.vintageRollerText}>{formattedMailCount[1]}</Text>
            </View>
          </View>
          
          {/* Glass reflection on counter */}
          <View style={styles.counterGlassReflection} />
        </View>
        
        {/* Bottom plate with target */}
        <View style={styles.counterBottomPlate}>
          <Text style={[styles.vintageCounterTarget, gibraltarPhase === 2 && styles.deliveryTarget]}>{targetText}</Text>
        </View>
        
        {/* Decorative screws - Phillips style */}
        <View style={[styles.counterScrew, { top: 4, left: 4 }]}>
          <View style={styles.screwCrossH} />
          <View style={styles.screwCrossV} />
        </View>
        <View style={[styles.counterScrew, { top: 4, right: 4 }]}>
          <View style={styles.screwCrossH} />
          <View style={styles.screwCrossV} />
        </View>
        <View style={[styles.counterScrew, { bottom: 4, left: 4 }]}>
          <View style={styles.screwCrossH} />
          <View style={styles.screwCrossV} />
        </View>
        <View style={[styles.counterScrew, { bottom: 4, right: 4 }]}>
          <View style={styles.screwCrossH} />
          <View style={styles.screwCrossV} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  counterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // === Dual counter row for Mauritanie ===
  dualCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  compactFrame: {
    backgroundColor: '#4A3828',
    borderRadius: 5,
    padding: 2,
    borderWidth: 2,
    borderTopColor: '#6B5344',
    borderLeftColor: '#6B5344',
    borderRightColor: '#3A2818',
    borderBottomColor: '#3A2818',
    alignItems: 'center',
    position: 'relative',
  },
  cumulFrameGold: {
    borderTopColor: '#7A6A3A',
    borderLeftColor: '#7A6A3A',
    borderRightColor: '#3A2808',
    borderBottomColor: '#3A2808',
  },
  compactLabel: {
    color: '#C4A882',
    fontSize: 5,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  compactLabelGold: {
    color: '#FFF',
    fontSize: 5,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  compactBody: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 3,
    padding: 3,
    borderWidth: 1.5,
    borderColor: '#333',
  },
  compactRollerContainer: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactRollerDigit: {
    width: 16,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
  },
  compactRollerText: {
    color: '#FFFDE7',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
  compactRollerTextGold: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
  compactGlassReflection: {
    position: 'absolute',
    top: 3,
    left: 5,
    right: 15,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
  },
  compactBottomPlate: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  compactTarget: {
    color: '#8B7355',
    fontSize: 8,
    fontFamily: 'BigNoodleTitling',
    fontWeight: 'bold',
  },
  cumulTopPlateGold: {
    backgroundColor: '#8B6914',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
    marginBottom: 2,
    borderWidth: 1,
    borderTopColor: '#AA8524',
    borderLeftColor: '#AA8524',
    borderRightColor: '#6B4904',
    borderBottomColor: '#6B4904',
  },
  cumulTargetGold: {
    color: '#FFD700',
    fontSize: 8,
    fontFamily: 'BigNoodleTitling',
    fontWeight: 'bold',
  },
  miniScrew: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8B7B60',
    borderWidth: 0.5,
    borderColor: '#5C4033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniScrewH: {
    position: 'absolute',
    width: 3,
    height: 0.8,
    backgroundColor: '#4A3828',
  },
  miniScrewV: {
    position: 'absolute',
    width: 0.8,
    height: 3,
    backgroundColor: '#4A3828',
  },
  // === Standard single counter styles ===
  vintageCounterFrame: {
    backgroundColor: '#4A3828',
    borderRadius: 6,
    padding: 3,
    borderWidth: 3,
    borderTopColor: '#6B5344',
    borderLeftColor: '#6B5344',
    borderRightColor: '#3A2818',
    borderBottomColor: '#3A2818',
    alignItems: 'center',
    position: 'relative',
  },
  counterTopPlate: {
    backgroundColor: '#5A4535',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 3,
    borderWidth: 1,
    borderTopColor: '#7A6555',
    borderLeftColor: '#7A6555',
    borderRightColor: '#4A3525',
    borderBottomColor: '#4A3525',
  },
  counterTopPlateDelivery: {
    backgroundColor: '#5A3525',
    borderTopColor: '#7A4535',
    borderLeftColor: '#7A4535',
    borderRightColor: '#4A2515',
    borderBottomColor: '#4A2515',
  },
  vintageCounterLabel: {
    color: '#C4A882',
    fontSize: 6,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  counterBody: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    padding: 4,
    borderWidth: 2,
    borderColor: '#333',
  },
  vintageRollerContainer: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  vintageRollerDigit: {
    width: 24,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
  },
  rollerSeparator: {
    width: 1,
    backgroundColor: '#333',
  },
  vintageRollerText: {
    color: '#FFFDE7',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
    textShadowColor: 'rgba(255,253,200,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  counterGlassReflection: {
    position: 'absolute',
    top: 4,
    left: 6,
    right: 20,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
  },
  counterBottomPlate: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  vintageCounterTarget: {
    color: '#8B7355',
    fontSize: 9,
    fontFamily: 'BigNoodleTitling',
    fontWeight: 'bold',
  },
  deliveryTarget: {
    color: '#CC0000',
  },
  counterScrew: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#8B7B60',
    borderWidth: 0.8,
    borderColor: '#5C4033',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screwCrossH: {
    position: 'absolute',
    width: 4,
    height: 1,
    backgroundColor: '#4A3828',
  },
  screwCrossV: {
    position: 'absolute',
    width: 1,
    height: 4,
    backgroundColor: '#4A3828',
  },
});
