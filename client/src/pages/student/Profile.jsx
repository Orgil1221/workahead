import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import ProfileView from './ProfileView.jsx';
import BadgeSettings from '../../chat/BadgeSettings.jsx';

async function loadPrograms() {
  const response = await api('/academic-programs');
  return response.programs;
}

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState(null);
  const [plansError, setPlansError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setPlansError(false);
    setPlans(null);
    api('/payments/plans').then((response) => {
      if (alive) setPlans(response.plans);
    }).catch(() => {
      if (alive) setPlansError(true);
    });
    return () => { alive = false; };
  }, [retry]);

  async function saveProfile(body) {
    const response = await api('/auth/profile', { method: 'PUT', body });
    updateUser(response.user);
    toast('Профайл хадгалагдлаа');
  }

  async function changePassword(body) {
    await api('/auth/password', { method: 'POST', body });
    toast('Нууц үг солигдлоо');
  }

  if (!user) return null;

  return <ProfileView user={user} plans={plans} plansError={plansError} chatSettings={<BadgeSettings />}
    onRetryPlans={() => setRetry((value) => value + 1)} loadPrograms={loadPrograms}
    onSaveProfile={saveProfile} onChangePassword={changePassword} onLogout={logout} />;
}
