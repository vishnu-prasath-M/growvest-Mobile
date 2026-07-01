import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

// TEMPORARILY DISABLED TO ISOLATE CRASH
const NotificationProvider = ({ children }) => {
  console.log('[NotificationProvider] DISABLED - investigating crash');
  return children;
};

export default NotificationProvider;
