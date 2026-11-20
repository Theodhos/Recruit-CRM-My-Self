'use client';

import { registrationRequestSchema, type RegistrationRequestInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';

import { useHydrated } from '@/hooks/use-hydrated';
import { ApiClientError } from '@/lib/api-client';
import { requestAccess } from '@/services/auth.service';

const NEXT_STEPS = [
  ['We review', 'Your request reaches our team.'],
  ['We get in touch', 'You are notified by email about your request.'],
  ['You start placing', 'Your workspace is ready for your agency.'],
];

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-bold uppercase tracking-[0.1em] text-[#6b6657]">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1.5 text-[13px] text-[#b42318]">{error}</p> : hint ? <p className="mt-1.5 text-[13px] text-[#8a846f]">{hint}</p> : null}
    </div>
  );
}

const inputClass =
  'w-full border border-[#cfc8b8] bg-white px-3.5 text-[16px] text-[#141414] placeholder:text-[#a8a290] outline-none transition-colors focus:border-[#c2410c] focus:ring-1 focus:ring-[#c2410c]';

function TextInput({ id, reg, ...rest }: { id: string; reg: UseFormRegisterReturn } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <input id={id} className={`${inputClass} h-12`} {...reg} {...rest} />;
}

/** The pop-up shown once the request has been sent. Closes with the button, a click outside, or Escape. */
function RequestSentDialog({ firstName, email, agency, onClose }: { firstName: string; email: string; agency: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="request-sent-dialog">
      <div className="absolute inset-0 bg-[#141414]/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-sent-title"
        aria-describedby="request-sent-text"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto bg-[#f6f3ec] p-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] sm:p-10"
      >
        <span className="inline-block bg-[#2f6b3b] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-white">Request sent</span>
        <h2 id="request-sent-title" className="mt-5 font-serif text-[2rem] font-bold leading-tight tracking-tight text-[#141414] sm:text-[2.4rem]">
          Thank you, {firstName}.
        </h2>
        <p id="request-sent-text" className="mt-3 text-[18px] leading-snug text-[#4a4538]">
          We have received your request for <b className="text-[#141414]">{agency}</b>. You will be notified, or we will get in touch, at{' '}
          <b className="break-all text-[#141414]">{email}</b>.
        </p>

        <ol className="mt-8 border-t border-[#cfc8b8]">
          {NEXT_STEPS.map(([t, d], i) => (
            <li key={t} className="grid grid-cols-[36px_1fr] items-baseline border-b border-[#cfc8b8] py-3.5">
              <span className="font-serif text-[22px] font-bold text-[#c2410c]">{i + 1}</span>
              <span>
                <b className="block text-[16px] text-[#141414]">{t}</b>
                <span className="text-[15px] text-[#6b6657]">{d}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-12 items-center justify-center bg-[#c2410c] px-8 text-[16px] font-semibold text-white transition-colors hover:bg-[#9a3412] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f3ec]"
          >
            Done
          </button>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center border border-[#141414] px-7 text-[16px] font-semibold text-[#141414] transition-colors hover:bg-[#141414] hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const hydrated = useHydrated();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ firstName: string; email: string; agency: string } | null>(null);

  const {
    register: registerField,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationRequestInput>({ resolver: zodResolver(registrationRequestSchema) });

  async function onSubmit(values: RegistrationRequestInput) {
    setServerError(null);
    try {
      await requestAccess({ ...values, phone: values.phone?.trim() || undefined, message: values.message?.trim() || undefined });
      setSent({ firstName: values.firstName, email: values.email, agency: values.organisationName });
    } catch (error) {
      setServerError(
        error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  }

  function closeDialog() {
    setSent(null);
    reset();
  }

  return (
    <>
      <div className="w-full max-w-md">
        <h2 className="font-serif text-[2rem] font-bold leading-tight tracking-tight sm:text-[2.4rem]">Set up your account</h2>
        <p className="mt-2 text-[17px] text-[#4a4538]">Tell us about your agency. We will get back to you.</p>

        <form className="mt-9 flex flex-col gap-5" method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field id="organisationName" label="Agency name" error={errors.organisationName?.message}>
            <TextInput id="organisationName" reg={registerField('organisationName')} placeholder="Acme Recruiting" autoComplete="organization" />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="firstName" label="First name" error={errors.firstName?.message}>
              <TextInput id="firstName" reg={registerField('firstName')} placeholder="Jamie" autoComplete="given-name" />
            </Field>
            <Field id="lastName" label="Last name" error={errors.lastName?.message}>
              <TextInput id="lastName" reg={registerField('lastName')} placeholder="Rivera" autoComplete="family-name" />
            </Field>
          </div>

          <Field id="email" label="Work email" error={errors.email?.message}>
            <TextInput id="email" type="email" reg={registerField('email')} placeholder="you@agency.com" autoComplete="email" />
          </Field>

          <Field id="phone" label="Phone (optional)" error={errors.phone?.message}>
            <TextInput id="phone" type="tel" reg={registerField('phone')} placeholder="+44 7700 900123" autoComplete="tel" />
          </Field>

          <Field id="message" label="Anything we should know? (optional)" error={errors.message?.message}>
            <textarea
              id="message"
              rows={3}
              className={`${inputClass} resize-y py-3`}
              placeholder="How many recruiters, what you place, what you use today…"
              {...registerField('message')}
            />
          </Field>

          {serverError ? (
            <p role="alert" className="border border-[#e9b8b2] bg-[#fdf1ef] px-3.5 py-3 text-[14px] text-[#b42318]">
              {serverError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!hydrated || isSubmitting}
            className="mt-1 inline-flex h-14 w-full items-center justify-center bg-[#c2410c] text-[17px] font-semibold text-white transition-colors hover:bg-[#9a3412] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f3ec] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Sending your request…' : 'Create account'}
          </button>
        </form>
      </div>

      {sent ? <RequestSentDialog {...sent} onClose={closeDialog} /> : null}
    </>
  );
}
