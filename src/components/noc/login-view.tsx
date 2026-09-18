'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Activity, Lock, Loader2, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { signIn } from 'next-auth/react'

interface LoginViewProps {
  onLoggedIn: () => void
}

export function LoginView({ onLoggedIn }: LoginViewProps) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })
      if (!res || res.error) {
        setError('Invalid username or password.')
        setSubmitting(false)
        return
      }
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">NOC TV Wall Console</h1>
            <p className="text-xs text-slate-500">Authentication required to post updates</p>
          </div>
        </div>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Lock className="h-5 w-5 text-slate-700" />
              Operator Login
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                  Username
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="border-slate-200 focus-visible:ring-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="border-slate-200 focus-visible:ring-slate-400"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  <ShieldAlert className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Sign In
              </Button>

              <p className="text-center text-xs text-slate-400">
                Tip: configure <code className="rounded bg-slate-100 px-1 py-0.5">NOC_ADMIN_PASSWORD</code> env var
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
