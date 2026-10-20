import SignupForm from './SignupForm'

// Serves both account types; ?role=fleet opens with "Fleet driver" chosen.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams
  return <SignupForm initialRole={role === 'fleet' ? 'fleet' : 'client'} verificationReady={process.env.AUTH_DEVICE_VERIFICATION === 'on'} />
}
