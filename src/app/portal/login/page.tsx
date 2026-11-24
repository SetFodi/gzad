import LoginForm from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; verified?: string; reset?: string }> }) {
  // /api/auth/callback sends people back here with ?error=auth.
  const { error, verified, reset } = await searchParams
  return <LoginForm linkFailed={error === 'auth'} emailVerified={verified === '1'} passwordReset={reset === '1'} />
}
