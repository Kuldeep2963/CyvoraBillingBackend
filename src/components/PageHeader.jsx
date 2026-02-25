import React, { useEffect } from 'react';
import { useNavbar } from '../context/NavbarContext';

const PageHeader = ({ title, subtitle, actions }) => {
  const { setTitle, setSubtitle, setActions } = useNavbar();

  useEffect(() => {
    setTitle(title);
    setSubtitle(subtitle);
    setActions(actions);
    
    return () => {
      setTitle('');
      setSubtitle('');
      setActions(null);
    };
  }, [title, subtitle, actions, setTitle, setSubtitle, setActions]);

  return null;
};

export default PageHeader;
