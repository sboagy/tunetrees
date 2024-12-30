import type React from "react";
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
  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogOverlay className="fixed inset-0 bg-opacity-50" />
      <DialogContent className="p-6 rounded shadow-lg">
        <DialogTitle>Confirm</DialogTitle>
        <DialogDescription className="text-black dark:text-white">
          {message}
        </DialogDescription>
        <div className="mt-4 flex justify-end space-x-2">
          <Button
            onClick={onCancel}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Cancel
          </Button>
          <Button
            onClick={onDiscard}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Discard
          </Button>
          <Button
            onClick={onSave}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveChangesOrNotDialog;
