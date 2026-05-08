import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';

// Video served from the Expo web public folder
const VIDEO_WEB_URL = '/pilot-background.webm';

// Web-specific video component using native HTML5 video element
const WebVideo: React.FC = () => {
  // On web, React.createElement('video') renders a native HTML5 <video> element
  return React.createElement('video', {
    src: VIDEO_WEB_URL,
    autoPlay: true,
    loop: true,
    muted: true,
    playsInline: true,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
  });
};

// Native video component using expo-av
const NativeVideo: React.FC = () => {
  // Lazy import to avoid web bundling issues
  const { Video, ResizeMode } = require('expo-av');
  return (
    <Video
      source={require('../../public/pilot-background.webm')}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      resizeMode={ResizeMode.COVER}
      shouldPlay
      isLooping
      isMuted
      useNativeControls={false}
    />
  );
};

export const VideoBackground: React.FC = () => {
  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? <WebVideo /> : <NativeVideo />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
});
