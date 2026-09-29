import { SecondaryButton } from './ui';
import { useDiscordSignIn } from '../hooks/useDiscordSignIn';

interface DiscordSignInButtonProps {
  /** Called after a sign-in that selected the player in the current lobby. */
  onSignedIn?: () => void;
}

/**
 * Opt-in "Sign in with Discord". Renders nothing outside the Discord activity
 * or once the user is signed in.
 */
export function DiscordSignInButton({ onSignedIn }: DiscordSignInButtonProps) {
  const { available, verifiedDiscordId, pending, failed, signIn } = useDiscordSignIn();

  if (!available || verifiedDiscordId) return null;

  const handleClick = async () => {
    if (await signIn()) onSignedIn?.();
  };

  return (
    <div className="discord-sign-in">
      <SecondaryButton type="button" onClick={handleClick} disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in with Discord'}
      </SecondaryButton>
      {failed && (
        <p className="discord-sign-in__error" role="alert">
          Discord sign-in didn't finish. Try again.
        </p>
      )}
    </div>
  );
}
