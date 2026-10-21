"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { useSession } from "@/lib/store";
import { getCountry } from "@/lib/countries";
import { REFERRAL_KEY } from "@/components/RememberReferral";
import {
  AuthScreen,
  CountryBar,
  PhoneField,
  LabeledInput,
  PasswordField,
  Check,
  PrimaryButton,
} from "@/components/AuthFields";

function RegisterForm() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const refFromUrl = (useSearchParams().get("ref") ?? "").trim().toUpperCase();

  const [countryCode, setCountryCode] = useState("GH");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [kycValue, setKycValue] = useState("");
  const [referralCode, setReferralCode] = useState(refFromUrl);
  const [lockedReferral, setLockedReferral] = useState(Boolean(refFromUrl));
  const [showReferral, setShowReferral] = useState(Boolean(refFromUrl));
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country = getCountry(countryCode);

  useEffect(() => {
    if (refFromUrl) {
      setReferralCode(refFromUrl);
      setLockedReferral(true);
      setShowReferral(true);
      try {
        localStorage.setItem(REFERRAL_KEY, refFromUrl);
      } catch {
        /* private mode */
      }
      return;
    }
    try {
      const saved = localStorage.getItem(REFERRAL_KEY)?.trim().toUpperCase();
      if (saved) {
        setReferralCode(saved);
        setLockedReferral(true);
        setShowReferral(true);
      }
    } catch {
      /* private mode */
    }
  }, [refFromUrl]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return setError("Enter your mobile number");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Enter a valid email address");
    }
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (!agreed) return setError("Accept the terms to continue");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: email.trim().split("@")[0] || phone,
          phone,
          email,
          password,
          countryCode,
          kycValue,
          referralCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not create your account");
        return;
      }
      try {
        localStorage.removeItem(REFERRAL_KEY);
      } catch {
        /* private mode */
      }
      signIn(json.user);
      router.push("/");
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Create an Account">
      <form onSubmit={submit} className="space-y-5">
        <CountryBar country={country} onChange={setCountryCode} />
        <PhoneField country={country} value={phone} onChange={setPhone} autoFocus />

        <LabeledInput
          label="Email Address"
          value={email}
          onChange={setEmail}
          placeholder="your@email.com"
          autoComplete="email"
          type="email"
          icon={<Mail size={18} className="shrink-0 text-zinc-400" />}
        />

        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="Min 6 characters"
        />

        <PasswordField
          label="Confirm Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Confirm Password"
        />

        {country.kyc.length > 0 && (
          <LabeledInput
            label={country.kyc[0].label}
            value={kycValue}
            onChange={setKycValue}
            placeholder={country.kyc[0].hint}
          />
        )}

        {lockedReferral ? (
          <div>
            <div className="relative">
              <span className="absolute -top-2 left-3 z-10 bg-[#111113] px-1 text-[12px] text-zinc-400">
                Referral Code
              </span>
              <span className="absolute -top-3 right-3 z-10 flex items-center gap-1 rounded-full border border-violet-400 bg-[#111113] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                <Lock size={10} /> Sub-admin referral attached
              </span>
              <div className="flex items-center gap-2.5 rounded-xl border border-violet-500 bg-gradient-to-r from-[#2a1848] to-[#1a1028] px-3 py-3.5">
                <Lock size={18} className="shrink-0 text-violet-300" />
                <span className="text-[16px] font-black tracking-wide">{referralCode}</span>
              </div>
            </div>
            <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-zinc-400">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
              Your account will be permanently linked to this affiliate partner.
            </p>
          </div>
        ) : showReferral ? (
          <LabeledInput
            label="Referral Code"
            value={referralCode}
            onChange={(v) => setReferralCode(v.toUpperCase())}
            placeholder="Referral code"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowReferral(true)}
            className="text-[14px] font-medium text-[#ff4d4d]"
          >
            Have a referral code?
          </button>
        )}

        <Check
          checked={agreed}
          onChange={setAgreed}
          label={
            <>
              I am 18+ and agree to the{" "}
              <Link href="/how-to-play" className="text-[#ff4d4d]">
                Terms & Conditions
              </Link>{" "}
              and{" "}
              <Link href="/how-to-play" className="text-[#ff4d4d]">
                Privacy Policy
              </Link>{" "}
              of Oddaroa.
            </>
          }
        />

        {error && (
          <p className="rounded-xl bg-red-950/60 px-3 py-2.5 text-[13px] text-red-300">{error}</p>
        )}

        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create Account"}
        </PrimaryButton>
      </form>

      <p className="mt-6 text-center text-[15px] text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#ff4d4d]">
          Login
        </Link>
      </p>
    </AuthScreen>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
