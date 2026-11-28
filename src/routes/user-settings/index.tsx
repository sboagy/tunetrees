/** Route-based entry shares the Settings shell and category draft with the overlay. */
import { useLocation, useNavigate } from "@solidjs/router";
import type { ParentComponent } from "solid-js";
import { SettingsShell } from "@/components/layout/UserSettingsDialog";
import {
  type UserSettingsTab,
  useUserSettingsDialog,
} from "@/contexts/UserSettingsDialogContext";

const UserSettingsLayout: ParentComponent = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useUserSettingsDialog();
  const tab = () => location.pathname.split("/").at(-1) as UserSettingsTab;
  const close = () =>
    settings.requestExit(() => {
      const returnTo = globalThis.sessionStorage?.getItem("tt-settings-return");
      globalThis.sessionStorage?.removeItem("tt-settings-return");
      navigate(
        returnTo?.startsWith("/") && !returnTo.startsWith("/user-settings")
          ? returnTo
          : "/",
        { replace: true }
      );
    });
  return (
    <SettingsShell
      open
      tab={tab()}
      onClose={close}
      onNavigate={(next) => navigate(`/user-settings/${next}`)}
      pending={settings.draft()?.pending()}
      footer={settings.draft()?.footer(close)}
    >
      {props.children}
    </SettingsShell>
  );
};
export default UserSettingsLayout;
