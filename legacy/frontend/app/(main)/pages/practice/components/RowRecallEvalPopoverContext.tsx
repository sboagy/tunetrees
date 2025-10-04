import type React from "react";
import { type ReactNode, createContext, useContext, useState } from "react";

interface IRowRecallEvalPopoverContextType {
  openPopoverId: number | null;
  setOpenPopoverId: (id: number | null) => void;
}

const RowRecallEvalPopoverContext = createContext<
  IRowRecallEvalPopoverContextType | undefined
>(undefined);

interface IRowRecallEvalPopoverProviderProps {
  children: ReactNode;
}

export const RowRecallEvalPopoverProvider: React.FC<
  IRowRecallEvalPopoverProviderProps
> = ({ children }) => {
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null);

  return (
    <RowRecallEvalPopoverContext.Provider
      value={{ openPopoverId, setOpenPopoverId }}
    >
      {children}
    </RowRecallEvalPopoverContext.Provider>
  );
};

export const useRowRecallEvalPopoverContext =
  (): IRowRecallEvalPopoverContextType => {
    const context = useContext(RowRecallEvalPopoverContext);
    if (!context) {
      throw new Error("usePopover must be used within a PopoverProvider");
    }
    return context;
  };
