import { z } from "zod";

export interface ILoginDialogProps {
  email?: string;
}

export const emailSchema = z.string().email("Invalid email address");
