import { Save, TrashIcon, XCircle } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
} from "./ui/dialog";

interface ISaveChangesOrNotDialogProps {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  message: string;
}

const SaveChangesOrNotDialog: React.FC<ISaveChangesOrNotDialogProps> = ({
  onSave,
  onDiscard,
  onCancel,
  message,
}) => {
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveButtonRef.current?.focus();
  });

  return (
    <Dialog
      open={true}
      onOpenChange={onCancel}
      // onOpenAutoFocus={(event) => {
      //   event.preventDefault();
      // }}
    >
      <DialogOverlay className="fixed inset-0 bg-opacity-50" />
      <DialogContent className="p-6 rounded shadow-lg">
        <DialogTitle>Confirm</DialogTitle>
        <DialogDescription className="text-black dark:text-white">
          {message}
        </DialogDescription>
        <div className="mt-4 flex justify-end space-x-2">
          <Button variant="ghost" onClick={onCancel} className="px-4 py-2">
            Cancel
            <XCircle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={onDiscard} className="px-4 py-2">
            Discard
            <TrashIcon className="h-4 w-4" />
          </Button>
          <Button
            id="saveButton"
            ref={saveButtonRef}
            variant="ghost"
            onClick={onSave}
            className="px-4 py-2"
            autoFocus
          >
            Save
            <Save className="h-4 w-4 bg-background text-foreground" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveChangesOrNotDialog;
