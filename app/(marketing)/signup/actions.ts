"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * There is no real account system here and there never will be — storing credentials
 * would be a liability with no teaching value. "Signing up" mints an opaque profile id in
 * a cookie; that id is what the personalized rows and My List key off later.
 *
 * The signature is deliberately `(formData) => Promise<void>` rather than the
 * `useActionState` shape `(prevState, formData)`. `useActionState` is a client hook, and
 * adopting it here would put React's client runtime into this route's critical path to
 * render one error string. Instead the failure path redirects back with `?error=`, so this
 * page ships no application JavaScript at all and the form still works with JS disabled.
 */
const SignupInput = z.object({
  email: z.string().trim().min(3).max(254).pipe(z.email()),
});

export async function signup(formData: FormData): Promise<void> {
  const raw = formData.get("email");
  const parsed = SignupInput.safeParse({ email: raw });

  if (!parsed.success) {
    const echoed = typeof raw === "string" ? raw.slice(0, 254) : "";
    redirect(`/signup?error=email&email=${encodeURIComponent(echoed)}`);
  }

  // A stable, non-identifying profile id. We deliberately do not store the email.
  const profileId = crypto.randomUUID();

  const jar = await cookies();
  jar.set("nfc_profile", profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/browse");
}
