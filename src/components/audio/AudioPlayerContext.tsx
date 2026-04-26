import {
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

export interface AudioPlayerTrack {
  referenceId: string;
  referenceTitle: string;
  url: string;
  regionsJson?: string | null;
  durationSeconds?: number | null;
  contentType?: string | null;
  originalFilename?: string | null;
}

interface AudioPlayerContextValue {
  currentTrack: () => AudioPlayerTrack | null;
  openTrack: (track: AudioPlayerTrack) => void;
  closeTrack: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue>();

export const AudioPlayerProvider: ParentComponent = (props) => {
  const [currentTrack, setCurrentTrack] = createSignal<AudioPlayerTrack | null>(
    null
  );

  const value: AudioPlayerContextValue = {
    currentTrack,
    openTrack: (track) => setCurrentTrack(track),
    closeTrack: () => setCurrentTrack(null),
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {props.children}
    </AudioPlayerContext.Provider>
  );
};

export function useAudioPlayer(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return context;
}
