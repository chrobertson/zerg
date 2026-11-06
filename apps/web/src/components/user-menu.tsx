import { useNavigate } from "@tanstack/react-router";
import { api } from "@zerg/backend/convex/_generated/api";
import { Button } from "@zerg/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zerg/ui/components/dropdown-menu";
import { useQuery } from "convex/react";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const user = useQuery(api.auth.getCurrentUser);
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="neutral" />}>{user?.name}</DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{user?.email}</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={async () => {
              // Leave the page first: workspace queries throw once the session ends.
              await navigate({ to: "/" });
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    location.reload();
                  },
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
