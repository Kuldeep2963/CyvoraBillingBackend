import React, { createContext, useState, useContext } from 'react';

const NavbarContext = createContext();

export const NavbarProvider = ({ children }) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [actions, setActions] = useState(null);

  return (
    <NavbarContext.Provider value={{ title, setTitle, subtitle, setSubtitle, actions, setActions }}>
      {children}
    </NavbarContext.Provider>
  );
};

export const useNavbar = () => {
  const context = useContext(NavbarContext);
  if (!context) {
    throw new Error('useNavbar must be used within a NavbarProvider');
  }
  return context;
};
