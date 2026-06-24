import { useState } from "react";
import { View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { AD_REQUEST_OPTIONS, BANNER_AD_UNIT_ID } from "@/services/ads";

/**
 * Inline anchored-adaptive banner for use inside scroll feeds. Renders nothing
 * if the ad fails to load so it never leaves an empty gap in the layout.
 */
export function AdBanner() {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <View style={{ alignItems: "center", marginVertical: 8 }}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={AD_REQUEST_OPTIONS}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

export default AdBanner;
