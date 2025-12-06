"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTabsState } from "./TabsStateContext";

const TabsMenu = () => {
  const { tabSpec, setTabVisibility, setActiveTab } = useTabsState();

  const handleCheckedChange = (tabId: string) => (value: boolean) => {
    setTabVisibility(tabId, value);
    // If enabling a tab, also activate it so its content becomes visible immediately
    if (value) {
      setActiveTab(tabId);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* I have to set the foreground color here because apparently the parent
        is set to gray. */}
        <Button variant="outline" className="ml-auto text-foreground">
          Tabs
          <ChevronDown className="ml-2 h-4 w-4 text-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {tabSpec.map((tab) => (
          <DropdownMenuCheckboxItem
            key={tab.id}
            className="capitalize"
            checked={tab.visible}
            onCheckedChange={handleCheckedChange(tab.id)}
          >
            {tab.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TabsMenu;
