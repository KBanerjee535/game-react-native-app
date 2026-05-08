import { ImageSourcePropType } from 'react-native';

// Mapping level ID → image de carte (partagé entre level.tsx et GameOverModal)
export const LEVEL_MAP_IMAGES: Record<string, ImageSourcePropType> = {
  europe_20: require('../../assets/images/europe-map-vintage-new.png'),
  europe_40: require('../../assets/images/europe-map-vintage-new.png'),
  gibraltar: require('../../assets/images/gibraltar-map.png'),
  gibraltar2: require('../../assets/images/gibraltar-map.png'),
  mauritanie: require('../../assets/images/mauritanie-map.png'),
  atlantique: require('../../assets/images/atlantique-map.png'),
  atlantique2: require('../../assets/images/atlantique-map.png'),
  amazonie: require('../../assets/images/amazonie-map.png'),
  buenos_aires: require('../../assets/images/buenosaires-map.png'),
  patagonie: require('../../assets/images/patagonie.png'),
  andes: require('../../assets/images/andes-map-v3.png'),
  paraguay: require('../../assets/images/paraguay-map.png'),
  africa_again: require('../../assets/images/africa-again-map.png'),
  sahel: require('../../assets/images/sahel-map.png'),
  campagne_europe: require('../../assets/images/campagne-europe-map.png'),
  niveau_16: require('../../assets/images/scandinavie-map.png'),
  corsica: require('../../assets/images/corsica-map-south.png'),
  sardegna: require('../../assets/images/sardegna-map-center.png'),
  afrique_nord: require('../../assets/images/afnord-map-center.png'),
  retour_france: require('../../assets/images/retourfrance-map-north.png'),
};

export const DEFAULT_MAP_IMAGE = require('../../assets/images/europe-map-vintage-new.png');
