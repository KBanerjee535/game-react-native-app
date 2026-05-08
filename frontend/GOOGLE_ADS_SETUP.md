# Google Ads Setup for Android

## Overview
The `AdModal.tsx` component has been updated to display Google AdMob banner ads on Android devices using the `react-native-google-mobile-ads` library.

## What Changed
- Added `Platform` detection to show Google Ads only on Android
- Added loading state with `ActivityIndicator` while ad loads
- Added error handling with fallback content if ad fails to load
- Enhanced timer logic to account for ad loading time
- Added `googleAdWrapper` styling for proper ad container

## Configuration Steps

### 1. Replace the Placeholder AdMob Unit ID
In `src/components/AdModal.tsx`, line 21, update the unit ID with your actual Android banner ad unit ID:

```typescript
const adUnitId = __DEV__
  ? TestIds.BANNER  // Uses test ads in development
  : Platform.OS === 'android'
    ? 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy'  // ← REPLACE THIS
    : undefined;
```

**To get your AdMob Unit ID:**
1. Go to [Google AdMob](https://admob.google.com/)
2. Sign in with your Google account
3. Create an app if you haven't already
4. Navigate to "Apps" → Your App → "Ad units"
5. Create a new Banner ad unit (or use existing one)
6. Copy the "Ad unit ID" (format: `ca-app-pub-XXXXXXXX/YYYYYYYYYY`)

### 2. Update AndroidManifest.xml (if not already configured)
Ensure your `android/app/src/main/AndroidManifest.xml` includes:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Inside <application> tag -->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-xxxxxxxxxxxxxxxxxxxxxxxx"/>
```

Replace with your actual AdMob App ID from AdMob console.

### 3. Update app.json (Expo Config)
If using Expo, ensure your `app.json` includes proper Android configuration:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-xxxxxxxxxxxxxxxxxxxxxxxx"
        }
      ]
    ]
  }
}
```

## How It Works

### Android Behavior
- Shows Google AdMob banner ad on Android devices
- Loading spinner appears while ad is fetching
- Auto-closes after 8 seconds (or 5 if loading)
- Falls back to placeholder content if ad fails to load

### Non-Android / Fallback Behavior
- Shows custom placeholder ad content
- Displays call-to-action button
- Auto-closes after 5 seconds

## Component Props

```typescript
interface AdModalProps {
  visible: boolean;    // Controls modal visibility
  onClose: () => void; // Callback when ad closes
}
```

## Usage Example

```typescript
import { AdModal } from '@/src/components/AdModal';
import { useState } from 'react';

export default function GameScreen() {
  const [showAd, setShowAd] = useState(false);

  return (
    <>
      <GameContent />
      <AdModal 
        visible={showAd}
        onClose={() => setShowAd(false)}
      />
    </>
  );
}
```

## Testing

### Development Testing
- The component uses `TestIds.BANNER` in development
- Google automatically recognizes test ads and serves them safely
- No need to use real ad unit IDs during development

### Production Testing
- Replace ad unit ID with your actual ID from AdMob
- Use emulator or physical device
- Monitor ad performance in AdMob console

## Debugging

If ads don't appear:

1. **Check Console Logs**: Look for `Ad failed to load:` messages
2. **Verify Unit ID**: Ensure it matches your AdMob settings
3. **Check Permissions**: Verify Android manifest has required permissions
4. **Network**: Ensure device has internet connectivity
5. **Test ID**: Try using `TestIds.BANNER` temporarily to verify setup

## Ad Unit ID Format
- **Format**: `ca-app-pub-XXXXXXXX/YYYYYYYYYY`
- **First Part**: AdMob Publisher ID
- **Second Part**: Unique Banner Ad Unit ID

## Related Files
- `src/components/AdModal.tsx` - Main ad modal component
- `app.json` - Expo configuration
- `android/app/src/main/AndroidManifest.xml` - Android manifest (if using bare Expo)
