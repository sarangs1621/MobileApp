"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

/**
 * Legacy conversation route. The conversation now lives inside the two-pane
 * `/messages` screen (design handoff), so this redirects — preserving any
 * bookmarked or deep-linked thread URLs (`?thread=` selects it there).
 */
export default function ConversationRedirect({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/messages?thread=${encodeURIComponent(threadId)}`);
  }, [threadId, router]);
  return null;
}
