"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { MY_LIST_COOKIE, parseMyList } from "@/lib/bff/context";

/**
 * Toggle a title in My List.
 *
 * The list is ids in a cookie. There is no account system, and adding one would be a
 * liability with no teaching value.
 *
 * This is a **mutation**, which matters more than it looks: Netflix's own replay-testing
 * technique for the GraphQL migration explicitly cannot validate non-idempotent fields
 * ("Migrating Netflix to GraphQL Safely", Shin/Shikhare/Emmanuel, 14 Jun 2023 — replay covers
 * idempotent requests only, and cannot check caching or logging behaviour either). So when
 * Phase 8 diffs REST against GraphQL, this path is deliberately excluded from replay and
 * validated through the A/B path instead. Marking it clearly now saves discovering it later.
 */
export async function toggleMyList(titleId: string): Promise<{ saved: boolean }> {
  if (!/^(movie|tv)-\d+$/.test(titleId)) {
    throw new Error(`Not a title id: "${titleId}"`);
  }

  const jar = await cookies();
  const current = parseMyList(jar.get(MY_LIST_COOKIE)?.value);

  const saved = !current.includes(titleId);
  const next = saved ? [titleId, ...current] : current.filter((id) => id !== titleId);

  jar.set(MY_LIST_COOKIE, next.join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // The list page and the detail page both read this cookie.
  revalidatePath("/my-list");

  return { saved };
}
