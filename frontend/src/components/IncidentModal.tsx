import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  warningCount: number;
}

export const IncidentModal: React.FC<Props> = ({ visible, onClose, warningCount }) => {
  const incidents = [
    { icon: 'engine-outline', title: 'Problème moteur !', desc: 'Le moteur fait des ratés.' },
    { icon: 'oil', title: 'Fuite d\'huile !', desc: 'Niveau d\'huile critique.' },
    { icon: 'fan', title: 'Hélice endommagée !', desc: 'Vibrations détectées.' },
    { icon: 'gauge', title: 'Pression anormale !', desc: 'Vérifiez les instruments.' },
  ];
  
  // Ensure we have a valid index - guard against undefined/NaN
  const safeCount = typeof warningCount === 'number' && !isNaN(warningCount) ? warningCount : 1;
  const incidentIndex = Math.max(0, Math.min(safeCount - 1, incidents.length - 1));
  const incident = incidents[incidentIndex] || incidents[0];
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons
              name="alert-octagon"
              size={40}
              color="#F44336"
            />
            <Text style={styles.title}>ALERTE MÉCANIQUE</Text>
          </View>
          
          {/* Content */}
          <View style={styles.content}>
            <MaterialCommunityIcons
              name={incident.icon as any}
              size={60}
              color="#FFD700"
            />
            <Text style={styles.incidentTitle}>{incident.title}</Text>
            <Text style={styles.incidentDesc}>{incident.desc}</Text>
            
            {/* Warning indicator */}
            <View style={styles.warningIndicator}>
              <Text style={styles.warningText}>
                Alertes: {warningCount}/4
              </Text>
              {warningCount >= 4 && (
                <Text style={styles.dangerText}>
                  ⚠️ 1 minute avant la panne totale!
                </Text>
              )}
            </View>
          </View>
          
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>COMPRIS</Text>
          </TouchableOpacity>
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
  },
  modal: {
    backgroundColor: '#2C1810',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    maxWidth: 350,
    borderWidth: 3,
    borderColor: '#8B4513',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#5C4033',
  },
  title: {
    color: '#F44336',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
  content: {
    alignItems: 'center',
    marginBottom: 20,
  },
  incidentTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  incidentDesc: {
    color: '#CCC',
    fontSize: 14,
    textAlign: 'center',
  },
  warningIndicator: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
  },
  warningText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dangerText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 5,
  },
  closeButton: {
    backgroundColor: '#8B4513',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignSelf: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
