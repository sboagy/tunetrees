"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useTabsState } from "./TabsStateContext";

const TabsMenu = () => {
  const { tabSpec, setTabVisibility } = useTabsState();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="ml-auto">
          Tabs
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {tabSpec.map((tab) => (
          <DropdownMenuCheckboxItem
            key={tab.id}
            className="capitalize"
            checked={tab.visible}
            onCheckedChange={(value) => setTabVisibility(tab.id, value)}
          >
            {tab.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TabsMenu;
