import React, { createContext, useState, useContext } from 'react';

const GlobalContext = createContext();

export const GlobalProvider = ({ children }) => {
  const [user, setUser] = useState({ name: 'Student', isLoggedIn: false });
  const [lastScanResult, setLastScanResult] = useState(null);

  return (
    <GlobalContext.Provider value={{ user, setUser, lastScanResult, setLastScanResult }}>
      {children}
    </GlobalContext.Provider>
  );
};

// Add this line exactly here to fix the lint error:
// eslint-disable-next-line react-refresh/only-export-components
export const useGlobal = () => useContext(GlobalContext);