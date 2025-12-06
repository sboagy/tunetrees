import { createContext, useContext, useState } from "react";

// This context is used to manage the view state of the main pane, to switch from the main
// tab view to the tune editor view.  In the future, this context could be expanded to
// include other views.

type MainPaneView = "tabs" | "edit";

type MainPaneViewContextType = {
  currentView: MainPaneView;
  setCurrentView: (view: MainPaneView) => void;
};

const MainPaneViewContext = createContext<MainPaneViewContextType | undefined>(
  undefined,
);

export const MainPaneViewProvider = ({ children }: React.PropsWithChildren) => {
  const [currentView, setCurrentView] = useState<MainPaneView>("tabs");

  return (
    <MainPaneViewContext.Provider value={{ currentView, setCurrentView }}>
      {children}
    </MainPaneViewContext.Provider>
  );
};

export const useMainPaneView = (): MainPaneViewContextType => {
  const context = useContext(MainPaneViewContext);
  if (!context) {
    throw new Error(
      "useMainPaneView must be used within a MainPaneViewProvider",
    );
  }
  return context;
};
