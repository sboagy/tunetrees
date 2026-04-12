import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  type ParentComponent,
  useContext,
} from "solid-js";

interface MobileControlBarContextValue {
  mobileContent: Accessor<JSX.Element | undefined>;
  setMobileContent: (content: JSX.Element | undefined) => void;
}

const MobileControlBarContext = createContext<MobileControlBarContextValue>();

export const useMobileControlBar = () => {
  const context = useContext(MobileControlBarContext);
  if (!context) {
    throw new Error(
      "useMobileControlBar must be used within MobileControlBarProvider"
    );
  }
  return context;
};

export const useRegisterMobileControlBar = (
  content: Accessor<JSX.Element | undefined>
) => {
  const { setMobileContent } = useMobileControlBar();

  createEffect(() => {
    setMobileContent(content());
  });

  onCleanup(() => {
    setMobileContent(undefined);
  });
};

export const MobileControlBarProvider: ParentComponent = (props) => {
  const [mobileContent, setMobileContent] = createSignal<JSX.Element>();

  return (
    <MobileControlBarContext.Provider
      value={{ mobileContent, setMobileContent }}
    >
      {props.children}
    </MobileControlBarContext.Provider>
  );
};
