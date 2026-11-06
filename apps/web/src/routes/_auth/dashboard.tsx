import { createFileRoute } from "@tanstack/react-router";
import { api } from "@zerg/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import UserMenu from "@/components/user-menu";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardContent,
});

function DashboardContent() {
  const workspace = useQuery(api.workspaces.current);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Workspace: {workspace?.name}</p>
      <UserMenu />
    </div>
  );
}
