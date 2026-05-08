import { useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

// Sons pré-chargés
const ENGINE_SOUND = require('../../assets/audio/engine-loop.wav');
const SPUTTER_SOUND = require('../../assets/audio/sputter.wav');
const LOW_FUEL_SOUND = require('../../assets/audio/low-fuel.wav');

interface UseGameAudioProps {
  isFlying: boolean;
  mechanicalWarnings: number;
  fuelLevel: number;
  gameStatus: string;
  soundEnabled: boolean;
}

export const useGameAudio = ({
  isFlying,
  mechanicalWarnings,
  fuelLevel,
  gameStatus,
  soundEnabled,
}: UseGameAudioProps) => {
  const engineSoundRef = useRef<Audio.Sound | null>(null);
  const sputterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  // Initialiser le mode audio
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch(console.log);
  }, []);

  // Jouer un son de raté (sputter)
  const playSputter = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(SPUTTER_SOUND, {
        volume: 0.6,
      });
      await sound.playAsync();
      // Libérer après lecture
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.log('Erreur sputter:', e);
    }
  }, [soundEnabled]);

  // Jouer le son de carburant bas
  const playLowFuel = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(LOW_FUEL_SOUND, {
        volume: 0.4,
      });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.log('Erreur low fuel:', e);
    }
  }, [soundEnabled]);

  // Gérer le moteur continu pendant le vol
  useEffect(() => {
    const startEngine = async () => {
      if (!soundEnabled || !isFlying || gameStatus !== 'playing') {
        // Arrêter le moteur
        if (engineSoundRef.current) {
          try {
            await engineSoundRef.current.stopAsync();
            await engineSoundRef.current.unloadAsync();
          } catch (e) {}
          engineSoundRef.current = null;
          isPlayingRef.current = false;
        }
        return;
      }

      // Démarrer le moteur
      if (!isPlayingRef.current) {
        try {
          const { sound } = await Audio.Sound.createAsync(ENGINE_SOUND, {
            isLooping: true,
            volume: 0.5,
          });
          engineSoundRef.current = sound;
          await sound.playAsync();
          isPlayingRef.current = true;
        } catch (e) {
          console.log('Erreur engine:', e);
        }
      }
    };

    startEngine();

    return () => {
      if (engineSoundRef.current) {
        engineSoundRef.current.stopAsync().catch(() => {});
        engineSoundRef.current.unloadAsync().catch(() => {});
        engineSoundRef.current = null;
        isPlayingRef.current = false;
      }
    };
  }, [isFlying, soundEnabled, gameStatus]);

  // Gérer les ratés (sputters) en fonction des voyants
  // 0 voyant = 0 raté, 1 voyant = 0 raté, 2e = 1 raté, 3e = 2 ratés, 4e = ratés constants
  useEffect(() => {
    // Nettoyer le timer précédent
    if (sputterTimerRef.current) {
      clearInterval(sputterTimerRef.current);
      sputterTimerRef.current = null;
    }

    if (!soundEnabled || !isFlying || gameStatus !== 'playing') return;

    if (mechanicalWarnings >= 4) {
      // Ratés constants (toutes les 300ms)
      sputterTimerRef.current = setInterval(() => {
        playSputter();
      }, 300);
    } else if (mechanicalWarnings === 3) {
      // 2 ratés par cycle (~2s)
      let count = 0;
      sputterTimerRef.current = setInterval(() => {
        count++;
        if (count % 4 <= 1) {
          playSputter();
        }
      }, 500);
    } else if (mechanicalWarnings === 2) {
      // 1 raté par cycle (~3s)
      sputterTimerRef.current = setInterval(() => {
        playSputter();
      }, 3000);
    }
    // 0-1 voyant = pas de ratés

    return () => {
      if (sputterTimerRef.current) {
        clearInterval(sputterTimerRef.current);
        sputterTimerRef.current = null;
      }
    };
  }, [mechanicalWarnings, isFlying, soundEnabled, gameStatus, playSputter]);

  // Alerte carburant bas
  useEffect(() => {
    if (!soundEnabled || !isFlying || gameStatus !== 'playing') return;
    if (fuelLevel > 0 && fuelLevel <= 15) {
      playLowFuel();
    }
  }, [fuelLevel <= 15, isFlying, soundEnabled, gameStatus]);

  // Arrêter tout quand le son est désactivé
  useEffect(() => {
    if (!soundEnabled) {
      if (engineSoundRef.current) {
        engineSoundRef.current.stopAsync().catch(() => {});
        engineSoundRef.current.unloadAsync().catch(() => {});
        engineSoundRef.current = null;
        isPlayingRef.current = false;
      }
      if (sputterTimerRef.current) {
        clearInterval(sputterTimerRef.current);
        sputterTimerRef.current = null;
      }
    }
  }, [soundEnabled]);

  // Nettoyage final
  useEffect(() => {
    return () => {
      if (engineSoundRef.current) {
        engineSoundRef.current.unloadAsync().catch(() => {});
      }
      if (sputterTimerRef.current) {
        clearInterval(sputterTimerRef.current);
      }
    };
  }, []);
};
