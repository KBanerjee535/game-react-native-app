import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Pressable,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Rect, Ellipse, G, Text as SvgText, Image as SvgImage, Defs, LinearGradient, Stop } from 'react-native-svg';
import { WRENCH_BASE64 } from '../src/assets/wrenchBase64';
import { useI18n } from '../src/i18n';

interface RuleCardProps {
  iconColor: string;
  title: string;
  description: string;
  customIcon: React.ReactNode;
}

const RuleCard: React.FC<RuleCardProps> = ({ iconColor, title, description, customIcon }) => (
  <View style={styles.ruleCard}>
    <View style={styles.ruleIconBg}>
      {customIcon}
    </View>
    <View style={styles.ruleContent}>
      <Text style={styles.ruleTitle}>{title}</Text>
      <Text style={styles.ruleDescription}>{description}</Text>
    </View>
  </View>
);

// ═══ ICÔNES EXACTES DU JEU ═══

const DestinationIcon = () => (
  <Svg width={56} height={32} viewBox="0 0 56 32">
    <Defs>
      <LinearGradient id="ruleBadgeBg" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#F5E6C8" />
        <Stop offset="1" stopColor="#D4C4A0" />
      </LinearGradient>
    </Defs>
    <Circle cx={13} cy={16} r={11} fill="#E8D5B0" stroke="#8B7355" strokeWidth={0.8} />
    <Circle cx={13} cy={16} r={9.5} fill="none" stroke="#3A2A1A" strokeWidth={1.2} />
    <Circle cx={13} cy={16} r={8} fill="#CC0000" />
    <Ellipse cx={11} cy={13.5} rx={2} ry={4} fill="rgba(255,255,255,0.4)" />
    <Rect x={25} y={5} width={28} height={16} rx={2.5} fill="url(#ruleBadgeBg)" stroke="#8B7355" strokeWidth={1} />
    <Rect x={26.5} y={6.5} width={25} height={13} rx={1.5} fill="none" stroke="#A89878" strokeWidth={0.4} />
    <Rect x={28} y={10} width={10} height={7} rx={0.8} fill="none" stroke="#3A2A1A" strokeWidth={1.2} />
    <Path d="M 28 10 L 33 14.5 L 38 10" stroke="#3A2A1A" strokeWidth={1.2} fill="none" />
    <SvgText x={43} y={18} fill="#3A2A1A" fontSize={10} fontWeight="bold" textAnchor="start">5</SvgText>
  </Svg>
);

const FuelIcon = () => (
  <Svg width={56} height={32} viewBox="0 0 56 32">
    <Defs>
      <LinearGradient id="ruleBadgeBg2" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#F5E6C8" />
        <Stop offset="1" stopColor="#D4C4A0" />
      </LinearGradient>
    </Defs>
    <Circle cx={13} cy={16} r={11} fill="#E8D5B0" stroke="#8B7355" strokeWidth={0.8} />
    <Circle cx={13} cy={16} r={9.5} fill="none" stroke="#3A2A1A" strokeWidth={1.2} />
    <Circle cx={13} cy={16} r={8} fill="#CC0000" />
    <Ellipse cx={11} cy={13.5} rx={2} ry={4} fill="rgba(255,255,255,0.4)" />
    <Rect x={25} y={5} width={28} height={16} rx={2.5} fill="url(#ruleBadgeBg2)" stroke="#8B7355" strokeWidth={1} />
    <Rect x={26.5} y={6.5} width={25} height={13} rx={1.5} fill="none" stroke="#A89878" strokeWidth={0.4} />
    <Rect x={29} y={10} width={7} height={8} rx={0.8} fill="none" stroke="#3A2A1A" strokeWidth={1.2} />
    <Rect x={30.5} y={7.5} width={4} height={2.5} rx={0.4} fill="none" stroke="#3A2A1A" strokeWidth={1} />
    <Line x1={36} y1={12} x2={38.5} y2={12} stroke="#3A2A1A" strokeWidth={1.2} />
    <Line x1={38.5} y1={12} x2={38.5} y2={15} stroke="#3A2A1A" strokeWidth={1.2} />
    <SvgText x={43} y={18} fill="#3A2A1A" fontSize={8} fontWeight="bold" textAnchor="start">+</SvgText>
  </Svg>
);

const CrossingIcon = () => (
  <Svg width={36} height={32} viewBox="0 0 36 32">
    <Path d="M 4 28 Q 18 4, 32 16" stroke="#8B6914" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray="4,3" />
    <Path d="M 4 6 Q 18 28, 32 12" stroke="#8B6914" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeDasharray="4,3" />
    <Circle cx={18} cy={16} r={5} fill="#FF6B00" opacity={0.3} />
    <Circle cx={18} cy={16} r={3} fill="#FF6B00" stroke="#FFFFFF" strokeWidth={1} />
  </Svg>
);

const WarningLightIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32">
    <Circle cx={16} cy={16} r={14} fill="#A08040" />
    <Circle cx={16} cy={16} r={13} fill="#8B7030" />
    <Ellipse cx={14} cy={11} rx={8} ry={1.8} fill="rgba(255,230,160,0.28)" />
    <Circle cx={16} cy={16} r={10.5} fill="#1a1a1a" />
    <Circle cx={16} cy={16} r={9} fill="#222" />
    <Circle cx={16} cy={16} r={7} fill="#F44336" />
    <Circle cx={16} cy={16} r={4.5} fill="#F44336" opacity={0.5} />
    <Ellipse cx={14.5} cy={13.5} rx={4} ry={2.2} fill="rgba(255,255,255,0.35)" />
    <Ellipse cx={17.5} cy={19} rx={1.2} ry={0.6} fill="rgba(255,255,255,0.08)" />
  </Svg>
);

const RepairIcon = () => (
  <Svg width={56} height={32} viewBox="0 0 56 32">
    <Defs>
      <LinearGradient id="ruleBadgeBg3" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#F5E6C8" />
        <Stop offset="1" stopColor="#D4C4A0" />
      </LinearGradient>
    </Defs>
    <Circle cx={13} cy={16} r={11} fill="#E8D5B0" stroke="#8B7355" strokeWidth={0.8} />
    <Circle cx={13} cy={16} r={9.5} fill="none" stroke="#3A2A1A" strokeWidth={1.2} />
    <Circle cx={13} cy={16} r={8} fill="#CC0000" />
    <Ellipse cx={11} cy={13.5} rx={2} ry={4} fill="rgba(255,255,255,0.4)" />
    <Rect x={25} y={5} width={28} height={16} rx={2.5} fill="url(#ruleBadgeBg3)" stroke="#8B7355" strokeWidth={1} />
    <Rect x={26.5} y={6.5} width={25} height={13} rx={1.5} fill="none" stroke="#A89878" strokeWidth={0.4} />
    <SvgImage x={30} y={6} width={18} height={16} href={WRENCH_BASE64} preserveAspectRatio="xMidYMid meet" />
  </Svg>
);

export default function HowToPlayScreen() {
  const router = useRouter();
  const { lang } = useI18n();
  const en = lang === 'en';

  return (
    <ImageBackground
      source={require('../assets/images/hangar-vintage.png')}
      style={styles.container}
      resizeMode="contain"
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#C8A55A" />
            <Text style={styles.backText}>{en ? 'BACK' : 'RETOUR'}</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.titleContainer}>
            <View style={styles.titleBar} />
            <Text style={styles.title}>{en ? 'GAME RULES' : 'RÈGLES DU JEU'}</Text>
            <View style={styles.titleBar} />
          </View>

          <View style={styles.introContainer}>
            <Text style={styles.introText}>
              {en
                ? 'You are an Aéropostale pilot in the 1930s. Your mission: carry mail across the world in perilous conditions.'
                : "Vous êtes un pilote de l'Aéropostale dans les années 1930. Votre mission : transporter le courrier à travers le monde dans des conditions périlleuses."}
            </Text>
          </View>

          <RuleCard
            customIcon={<MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />}
            iconColor="#FFD700"
            title={en ? 'OBJECTIVE' : 'OBJECTIF'}
            description={en
              ? 'Each turn, choose your destinations to collect as many mails as possible.'
              : 'A chaque tour, choisissez vos destinations pour collecter un maximum de courriers.'}
          />

          <RuleCard
            customIcon={<DestinationIcon />}
            iconColor="#CC0000"
            title="DESTINATIONS"
            description={en
              ? 'At each stop, 3 destinations are offered. Each contains mail, sometimes fuel or a repair kit. Tap a destination to fly there.'
              : 'À chaque escale, 3 destinations vous sont proposées. Chacune contient du courrier, parfois du carburant ou un kit de réparation. Touchez une destination pour vous y envoler.'}
          />

          <RuleCard
            customIcon={<FuelIcon />}
            iconColor="#4CAF50"
            title={en ? 'FUEL' : 'CARBURANT'}
            description={en
              ? 'Your fuel gauge drops with each flight. The farther the destination, the more you consume. If the tank is empty, you crash! Look for fuel cans to refuel.'
              : "Votre jauge d'essence diminue à chaque vol. Plus la destination est éloignée, plus vous consommez. Si le réservoir est vide, c'est le crash ! Cherchez les bidons d'essence pour refaire le plein."}
          />

          <RuleCard
            customIcon={<CrossingIcon />}
            iconColor="#FF6B00"
            title={en ? 'CROSSED PATHS' : 'TRAJECTOIRES CROISÉES'}
            description={en
              ? 'Watch out for crossings! If your path crosses a route already taken, a warning light turns on. Plan your routes to avoid intersections.'
              : "Attention aux croisements ! Si votre trajectoire croise une route déjà empruntée, un voyant d'alerte s'allume sur le tableau de bord. Planifiez vos routes pour éviter les intersections."}
          />

          <RuleCard
            customIcon={<WarningLightIcon />}
            iconColor="#F44336"
            title={en ? 'MECHANICAL FAILURES' : 'PANNES MÉCANIQUES'}
            description={en
              ? '4 warning lights in total. If all 4 are on, you have 1 minute to find a repair kit (wrench). During this critical minute, no path crossing is tolerated or you crash immediately.'
              : "4 voyants d'alerte au total. Si les 4 s'allument, vous avez 1 minute pour trouver un kit de réparation (clé à molette). Pendant cette minute critique, aucun croisement de trajectoire n'est toléré sous peine de crash immédiat."}
          />

          <RuleCard
            customIcon={<RepairIcon />}
            iconColor="#2196F3"
            title={en ? 'REPAIRS' : 'RÉPARATIONS'}
            description={en
              ? 'Repair kits are rare (10% chance). They turn off a warning light. If you are in critical failure, the repair cancels the countdown.'
              : "Les kits de réparation sont rares (10% de chance). Ils éteignent un voyant d'alerte. Si vous êtes en panne critique, la réparation annule le compte à rebours."}
          />

          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>{en ? 'FLIGHT TIPS' : 'CONSEILS DE VOL'}</Text>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                {en ? 'Prefer nearby destinations to save fuel' : 'Privilégiez les destinations proches pour économiser du carburant'}
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                {en ? 'Avoid crossing your own routes to prevent warning lights' : 'Évitez de croiser vos propres routes pour ne pas allumer de voyants'}
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                {en ? "Don't neglect fuel cans and repairs" : "Ne négligez pas les bidons d'essence et les réparations"}
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                {en ? 'If 3 lights are on, find a repair as a priority!' : 'Si 3 voyants sont allumés, cherchez une réparation en priorité !'}
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0804' },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 5 },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#C8A55A', fontSize: 14, fontWeight: '600', fontFamily: 'BigNoodleTitling', letterSpacing: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  titleContainer: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  titleBar: { width: 180, height: 2, backgroundColor: '#C8A55A', marginVertical: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#C8A55A', fontFamily: 'BigNoodleTitling', letterSpacing: 3 },
  introContainer: { backgroundColor: 'rgba(10, 8, 4, 0.92)', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(200, 165, 90, 0.3)' },
  introText: { color: '#D4C4A0', fontSize: 14, lineHeight: 22, textAlign: 'center', fontStyle: 'italic' },
  ruleCard: { flexDirection: 'row', backgroundColor: 'rgba(10, 8, 4, 0.92)', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(200, 165, 90, 0.2)' },
  ruleIconBg: { width: 56, height: 38, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  ruleContent: { flex: 1 },
  ruleTitle: { color: '#C8A55A', fontSize: 15, fontWeight: 'bold', fontFamily: 'BigNoodleTitling', letterSpacing: 1.5, marginBottom: 4 },
  ruleDescription: { color: '#B0A080', fontSize: 12.5, lineHeight: 18 },
  tipsContainer: { backgroundColor: 'rgba(10, 8, 4, 0.92)', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(200, 165, 90, 0.3)' },
  tipsTitle: { color: '#C8A55A', fontSize: 16, fontWeight: 'bold', fontFamily: 'BigNoodleTitling', letterSpacing: 2, marginBottom: 12, textAlign: 'center' },
  tipRow: { flexDirection: 'row', marginBottom: 8 },
  tipBullet: { color: '#C8A55A', fontSize: 16, marginRight: 8, marginTop: -2 },
  tipText: { color: '#B0A080', fontSize: 13, lineHeight: 18, flex: 1 },
});
