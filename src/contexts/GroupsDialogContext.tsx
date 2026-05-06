import {
  type Accessor,
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

interface GroupsDialogContextValue {
  isOpen: Accessor<boolean>;
  openGroupsDialog: () => void;
  closeGroupsDialog: () => void;
  /** Signal that consumers (e.g. Setlists tab) read to reactively refetch
   *  their group list whenever a group is created, updated, or deleted. */
  groupListVersion: Accessor<number>;
  /** Bump the signal to notify consumers that the group list changed. */
  refreshGroups: () => void;
}

const GroupsDialogContext = createContext<GroupsDialogContextValue>();

export function useGroupsDialog(): GroupsDialogContextValue {
  const context = useContext(GroupsDialogContext);
  if (!context) {
    throw new Error(
      "useGroupsDialog must be used inside <GroupsDialogProvider>"
    );
  }

  return context;
}

export const GroupsDialogProvider: ParentComponent = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [groupListVersion, setGroupListVersion] = createSignal(0);

  return (
    <GroupsDialogContext.Provider
      value={{
        isOpen,
        openGroupsDialog: () => setIsOpen(true),
        closeGroupsDialog: () => setIsOpen(false),
        groupListVersion,
        refreshGroups: () => setGroupListVersion((v) => v + 1),
      }}
    >
      {props.children}
    </GroupsDialogContext.Provider>
  );
};
