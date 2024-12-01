// RecallEvalRadioGroup.tsx
import React from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { CellContext } from "@tanstack/react-table";

import type { ITuneOverview } from "../types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RecallEvalRadioGroup(info: CellContext<ITuneOverview, unknown>) {
  const [position, setPosition] = React.useState("...");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span>{position}</span>
        {/* <MoreHorizontal className="h-4 w-4" /> */}
        {/* <Button variant="outline">Open</Button> */}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Enter Recall Evaluation</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
          <DropdownMenuRadioItem value="notSet">Not Set</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="failed">
            Failed (no recall)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="barely">
            Barely Remembered Some (perhaps A part but not B part)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="struggled">
            Remembered with Some Mistakes (and needed verification)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="recalled">
            Recalled with Some Work (but without help)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="trivial">
            Not Bad (but maybe not session ready)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="perfect">
            Good (could perform solo or lead in session)
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export default RecallEvalRadioGroup;
