import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';

// Google's official test Banner Ad Unit ID
// Always returns test ads and is safe for development
const TEST_BANNER_AD_UNIT = 'ca-app-pub-3940256099942544/6300978111';

// Replace this with your actual Android AdMob unit ID once approved
const PRODUCTION_ANDROID_AD_UNIT = 'ca-app-pub-2451759148839947/7085147045';
const PRODUCTION_IOS_AD_UNIT = 'ca-app-pub-2451759148839947/8107006133';

const adUnitId = Platform.OS === 'ios'
    ? PRODUCTION_IOS_AD_UNIT
    : PRODUCTION_ANDROID_AD_UNIT;


interface AdModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AdModal: React.FC<AdModalProps> = ({ visible, onClose }) => {
  const [adLoading, setAdLoading] = useState(true);
  const [adError, setAdError] = useState(false);

  useEffect(() => {
    if (visible) {
      //Auto-close after 15 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.adContainer}>
          {/* Ad Header */}
          <View style={styles.adHeader}>
            <Text style={styles.adLabel}>ADVERTISEMENT</Text>
            <Pressable onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#FFF" />
            </Pressable>
          </View>

          {/* Google Ad Banner - Android Only */}
          {adUnitId ? (
            <View style={styles.googleAdWrapper}>
              {adLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFD700" />
                  <Text style={styles.loadingText}>Loading ad...</Text>
                </View>
              )}
              {!adError && (
                <BannerAd
                  unitId={adUnitId}
                  size={BannerAdSize.BANNER}
                  requestOptions={{
                    requestNonPersonalizedAdsOnly: false,
                  }}
                  onAdLoaded={() => {
                    console.log('Ad loaded successfully');
                    setAdLoading(false);
                  }}
                  onAdFailedToLoad={(error) => {
                    console.log('Ad failed to load:', error);
                    setAdError(true);
                    setAdLoading(false);
                  }}
                />
              )}
            </View>
          ) : !adError ? (
            // Fallback content for non-Android or if ad loading fails
            <View style={styles.adContent}>
              <MaterialCommunityIcons name="briefcase" size={64} color="#FFD700" />
              <Text style={styles.adTitle}>Amazing Deals Await!</Text>
              <Text style={styles.adDescription}>
                Check out our exclusive offers and products
              </Text>
              <Text style={styles.adSubtext}>
                Ad will close automatically in 5 seconds...
              </Text>
            </View>
          ) : null}

          {/* CTA Button - Show for fallback content only */}
          {(adError) && (
            <Pressable style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>Learn More</Text>
            </Pressable>
          )}

          {/* Skip Button */}
          <Pressable 
            style={styles.skipButton}
            onPress={onClose}
          >
            <Text style={styles.skipButtonText}>Skip Ad</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginHorizontal: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#FFD700',
  },
  adLabel: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    fontFamily: 'BigNoodleTitling',
  },
  googleAdWrapper: {
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  loadingContainer: {
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  loadingText: {
    marginLeft: 10,
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  adContent: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  adTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'BigNoodleTitling',
  },
  adDescription: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  adSubtext: {
    color: '#888888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  ctaButton: {
    backgroundColor: '#FFD700',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
  skipButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'BigNoodleTitling',
  },
});
