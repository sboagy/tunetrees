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

  return (
    <GroupsDialogContext.Provider
      value={{
        isOpen,
        openGroupsDialog: () => setIsOpen(true),
        closeGroupsDialog: () => setIsOpen(false),
      }}
    >
      {props.children}
    </GroupsDialogContext.Provider>
  );
};
