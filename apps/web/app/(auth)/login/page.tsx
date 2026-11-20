'use client';

import { Button, Input, Label } from '@crm/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/auth/auth-card';
import { loginSchema, type LoginInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from '@crm/ui/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useHydrated } from '@/hooks/use-hydrated';
import { markTabSignedIn, useInvalidateSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { login as loginRequest } from '@/services/auth.service';

// `useSearchParams()` must sit under a Suspense boundary so the route can be statically prerendered.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

/**
 * E-mail + password. That signs in directly; when the API has the e-mail code switched on it answers with a
 * pending challenge instead, and /verify-code is where the session is obtained.
 */
function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateSession = useInvalidateSession();
  const hydrated = useHydrated();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const challenge = await loginRequest(values);
      if (!challenge.otpRequired) {
        markTabSignedIn();
        await invalidateSession();
        router.push('/dashboard');
        return;
      }
      // a development server without a mail server hands the code over for the next page to show (see verify-code)
      try {
        if (challenge.devCode) sessionStorage.setItem('crm.devLoginCode', challenge.devCode);
        else sessionStorage.removeItem('crm.devLoginCode');
      } catch {
        /* private mode */
      }
      router.push('/verify-code');
    } catch (error) {
      setServerError(
        error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your credentials to access your organisation.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* method="post": a submit the browser handles itself must never put the password in the address bar */}
          <form className="flex flex-col gap-4" method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" {...register('email')} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>
            {serverError ? (
              <p className="text-sm text-destructive">{serverError}</p>
            ) : searchParams.get('notice') ? (
              <p className="text-sm text-foreground/60">{searchParams.get('notice')}</p>
            ) : null}
            <Button type="submit" className="mt-2" disabled={!hydrated || isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-8 text-sm">
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Forgot your password?
        </Link>
      </p>
    </div>
  );
}
