/**
 * Confirm Dialog Component
 *
 * A simple confirmation dialog for destructive actions.
 * Now powered by Kobalte AlertDialog for better accessibility.
 *
 * Features:
 * - Modal overlay with backdrop
 * - Confirm/Cancel buttons
 * - Keyboard support (Escape to cancel) - built-in
 * - Dark mode support
 * - Improved focus management and ARIA attributes
 *
 * @module components/ui/ConfirmDialog
 */

import type { Component } from "solid-js";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";

interface ConfirmDialogProps {
	/** Whether the dialog is open */
	isOpen: boolean;
	/** Dialog title */
	title: string;
	/** Dialog message/content */
	message: string;
	/** Confirm button text (default: "Confirm") */
	confirmText?: string;
	/** Cancel button text (default: "Cancel") */
	cancelText?: string;
	/** Confirm button variant (default: "danger") */
	variant?: "danger" | "primary";
	/** Callback when confirmed */
	onConfirm: () => void;
	/** Callback when cancelled or closed */
	onCancel: () => void;
}

/**
 * Confirm Dialog Component
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showDeleteDialog()}
 *   title="Delete Tunes?"
 *   message="Are you sure you want to delete 3 tunes? This action cannot be undone."
 *   confirmText="Delete"
 *   variant="danger"
 *   onConfirm={handleDeleteConfirm}
 *   onCancel={() => setShowDeleteDialog(false)}
 * />
 * ```
 */
export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
	return (
		<AlertDialog
			open={props.isOpen}
			onOpenChange={(open) => {
				if (!open) {
					props.onCancel();
				}
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{props.title}</AlertDialogTitle>
					<AlertDialogDescription>{props.message}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<Button variant="outline" onClick={props.onCancel}>
						{props.cancelText || "Cancel"}
					</Button>
					<Button
						variant={props.variant === "primary" ? "default" : "destructive"}
						onClick={props.onConfirm}
					>
						{props.confirmText || "Confirm"}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
