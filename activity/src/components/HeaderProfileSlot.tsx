import { useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileModal } from './ProfileModal';
import { useAppStore } from '../store/store';

export function HeaderProfileSlot() {
  const [open, setOpen] = useState(false);
  const setView = useAppStore((s) => s.setView);

  return (
    <>
      <ProfileAvatar onClick={() => setOpen(true)} />
      <ProfileModal
        open={open}
        onClose={() => setOpen(false)}
        onOpenConnections={() => {
          setOpen(false);
          setView('connections');
        }}
      />
    </>
  );
}
