/* hooks/useRoleGuard.js — Redirect unauthorized users */
import { useEffect } from 'react';
import useAppStore from '../store/appStore';

export default function useRoleGuard(allowedRoles) {
  const user = useAppStore(s => s.user);

  useEffect(() => {
    if (user && allowedRoles && !allowedRoles.includes(user.role)) {
      console.warn(`Access denied for role: ${user.role}`);
    }
  }, [user, allowedRoles]);

  if (!user) return false;
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(user.role);
}
