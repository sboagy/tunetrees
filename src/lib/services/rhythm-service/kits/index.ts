import { BODHRAN_KIT } from "@/lib/services/rhythm-service/kits/bodhran";
import { GENERIC_CLICK_KIT } from "@/lib/services/rhythm-service/kits/generic-click";
import { MELODIC_TOM_KIT } from "@/lib/services/rhythm-service/kits/melodic-tom";
import type { SampleKitDefinition } from "@/lib/services/rhythm-service/kits/types";

export {
  BODHRAN_SAMPLE_KIT,
  getBodhranMappedMidiSamplePitch,
  getBodhranPlaybackGainMultiplier,
  mapBodhranElementPitchToSamplePitch,
} from "@/lib/services/rhythm-service/kits/bodhran";
export {
  GENERIC_CLICK_PRIMARY_PITCH,
  GENERIC_CLICK_SAMPLE_KIT,
  GENERIC_CLICK_SECONDARY_PITCH,
} from "@/lib/services/rhythm-service/kits/generic-click";
export { MELODIC_TOM_SAMPLE_KIT } from "@/lib/services/rhythm-service/kits/melodic-tom";
export type {
  SampleKitDefinition,
  SampleKitEntry,
  SampleKitFileEntry,
  SampleKitSyntheticEntry,
} from "@/lib/services/rhythm-service/kits/types";

export const DEFAULT_SAMPLE_KIT = "generic_click";

export const SAMPLE_KITS: Record<string, SampleKitDefinition> = {
  bodhran: BODHRAN_KIT,
  melodicTom: MELODIC_TOM_KIT,
  generic_click: GENERIC_CLICK_KIT,
};
