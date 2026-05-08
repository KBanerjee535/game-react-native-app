import { Stack } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { View, Text, TextInput } from 'react-native';
import { I18nProvider } from '../src/i18n';
import { MobileAds } from 'react-native-google-mobile-ads';

SplashScreen.preventAutoHideAsync();

// Appliquer BigNoodleTitling comme police par défaut pour TOUS les textes
const applyDefaultFont = () => {
  const fontFamily = 'BigNoodleTitling';
  
  // Override Text.render pour injecter la police par défaut
  const originalTextRender = (Text as any).render;
  if (originalTextRender) {
    (Text as any).render = function(props: any, ref: any) {
      return originalTextRender.call(this, {
        ...props,
        style: [{ fontFamily }, props.style],
      }, ref);
    };
  }
  
  // Override TextInput aussi
  const originalInputRender = (TextInput as any).render;
  if (originalInputRender) {
    (TextInput as any).render = function(props: any, ref: any) {
      return originalInputRender.call(this, {
        ...props,
        style: [{ fontFamily }, props.style],
      }, ref);
    };
  }
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BigNoodleTitling: require('../assets/fonts/BigNoodleTitling.ttf'),
  });

  // Initialize Google Mobile Ads
  useEffect(() => {
    const initMobileAds = async () => {
      try {
        await MobileAds().initialize();
        console.log('Google Mobile Ads initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Google Mobile Ads:', error);
      }
    };
    initMobileAds();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      applyDefaultFont();
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <I18nProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="level" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="freeplay" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="howtoplay" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </View>
    </I18nProvider>
  );
}
