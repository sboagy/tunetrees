import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import GroupsManagerDialog from "@/components/groups/GroupsManagerDialog";

const GroupsPage: Component = () => {
  const navigate = useNavigate();

  return (
    <GroupsManagerDialog
      isOpen={true}
      routeMode={true}
      onClose={() => navigate("/", { replace: true })}
    />
  );
};

export default GroupsPage;
