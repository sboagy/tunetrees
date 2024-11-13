   // TuneContext.tsx
   import React, { createContext, useContext, useState, ReactNode } from 'react';

   interface TuneContextType {
     currentTune: number | null;
     setCurrentTune: (tuneId: number | null) => void;
   }

   const TuneContext = createContext<TuneContextType | undefined>(undefined);

   export const TuneProvider = ({ children }: { children: ReactNode }) => {
     const [currentTune, setCurrentTune] = useState<number | null>(null);
     return (
       <TuneContext.Provider value={{ currentTune, setCurrentTune }}>
         {children}
       </TuneContext.Provider>
     );
   };

   export const useTune = () => {
     const context = useContext(TuneContext);
     if (context === undefined) {
       throw new Error('useTune must be used within a TuneProvider');
     }
     return context;
   };