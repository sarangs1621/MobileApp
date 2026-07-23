import { useTranslation } from "@repo/i18n";

import { NavHubScreen } from "../../../components/nav-menu";

/** Parent / Teacher "More" tab — the permission-gated navigation hub. */
export default function MoreTab() {
  const { dict } = useTranslation();
  return <NavHubScreen title={dict.tabs.more} />;
}
