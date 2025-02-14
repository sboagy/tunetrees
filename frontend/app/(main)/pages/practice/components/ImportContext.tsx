import type React from "react";
import { type ReactNode, createContext, useContext, useState } from "react";

// Define the context type
interface IImportContextType {
  importUrl: string | null;
  setImportUrl: (url: string | null) => void;
}

// Create the context
const ImportContext = createContext<IImportContextType | undefined>(undefined);

// Create a custom hook to use the context
export const useImportUrl = (): IImportContextType => {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error("useImportUrl must be used within an ImportProvider");
  }
  return context;
};

// Create the provider component
export const ImportProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [importUrl, setImportUrl] = useState<string | null>(null);

  return (
    <ImportContext.Provider value={{ importUrl, setImportUrl }}>
      {children}
    </ImportContext.Provider>
  );
};
