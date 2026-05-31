"use client";

import * as React from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusToggle } from "@/components/admin/status-toggle";
import { DeleteButton } from "@/components/admin/delete-button";
import { PlayerEditDialog } from "@/components/admin/player-edit-dialog";
import type { Player, PlayerRole, PlayerStatus } from "@/lib/types/database";

type RoleFilter = "all" | PlayerRole;
type StatusFilter = "all" | PlayerStatus;
type SaleFilter = "all" | "sold" | "unsold";
type SortKey = "newest" | "oldest" | "name_asc" | "name_desc";

function StatPill({
  label,
  value,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: number;
  tone: "neutral" | "yellow" | "green" | "red" | "blue" | "orange";
  onClick?: () => void;
  active?: boolean;
}) {
  const styles: Record<string, string> = {
    neutral: "bg-muted text-foreground",
    yellow: "bg-yellow-100 text-yellow-800",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    orange: "bg-orange-100 text-orange-800",
  };
  const baseCls = `flex flex-col rounded-md px-3 py-2 ${styles[tone]} ${
    onClick ? "cursor-pointer transition hover:brightness-95 active:scale-95" : ""
  } ${active ? "ring-2 ring-offset-1 ring-cricket-pitch" : ""}`;
  const inner = (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </span>
      <span className="text-lg font-bold leading-none">{value}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={baseCls} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={baseCls}>{inner}</div>;
}

export function PlayersTable({ players }: { players: Player[] }) {
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState<RoleFilter>("all");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [sale, setSale] = React.useState<SaleFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("newest");

  // Stats — always over the full set, not the filtered subset
  const stats = React.useMemo(() => {
    return {
      total: players.length,
      pending: players.filter((p) => p.status === "Pending").length,
      verified: players.filter((p) => p.status === "Verified").length,
      rejected: players.filter((p) => p.status === "Rejected").length,
      sold: players.filter((p) => p.team_id).length,
    };
  }, [players]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = players.filter((p) => {
      if (role !== "all" && p.role !== role) return false;
      if (status !== "all" && p.status !== status) return false;
      if (sale === "sold" && !p.team_id) return false;
      if (sale === "unsold" && p.team_id) return false;
      if (q) {
        const hay = `${p.full_name} ${p.phone ?? ""} ${p.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "newest":
          return b.created_at.localeCompare(a.created_at);
        case "oldest":
          return a.created_at.localeCompare(b.created_at);
        case "name_asc":
          return a.full_name.localeCompare(b.full_name);
        case "name_desc":
          return b.full_name.localeCompare(a.full_name);
      }
    });

    return list;
  }, [players, query, role, status, sale, sort]);

  const filtersActive =
    query !== "" || role !== "all" || status !== "all" || sale !== "all";

  function clearFilters() {
    setQuery("");
    setRole("all");
    setStatus("all");
    setSale("all");
  }

  return (
    <>
      {/* Stats — click to filter */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatPill
          label="Total"
          value={stats.total}
          tone="neutral"
          onClick={() => {
            setStatus("all");
            setRole("all");
            setSale("all");
            setQuery("");
          }}
        />
        <StatPill
          label="Pending"
          value={stats.pending}
          tone="yellow"
          onClick={() => {
            setStatus("Pending");
            setSale("all");
          }}
          active={status === "Pending"}
        />
        <StatPill
          label="Verified"
          value={stats.verified}
          tone="green"
          onClick={() => {
            setStatus("Verified");
            setSale("all");
          }}
          active={status === "Verified"}
        />
        <StatPill
          label="Rejected"
          value={stats.rejected}
          tone="red"
          onClick={() => {
            setStatus("Rejected");
            setSale("all");
          }}
          active={status === "Rejected"}
        />
        <StatPill
          label="Sold"
          value={stats.sold}
          tone="blue"
          onClick={() => {
            setSale("sold");
            setStatus("all");
          }}
          active={sale === "sold"}
        />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, or city…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="Batsman">Batsman</SelectItem>
              <SelectItem value="Bowler">Bowler</SelectItem>
              <SelectItem value="All-rounder">All-rounder</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
          >
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Verified">Verified</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sale} onValueChange={(v) => setSale(v as SaleFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-36">
              <SelectValue placeholder="Sale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All players</SelectItem>
              <SelectItem value="sold">Sold (in a team)</SelectItem>
              <SelectItem value="unsold">Unsold / available</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-full sm:w-40">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name_asc">Name A → Z</SelectItem>
              <SelectItem value="name_desc">Name Z → A</SelectItem>
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">
            {filtered.length === players.length
              ? `Registrations (${players.length})`
              : `${filtered.length} of ${players.length}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {players.length === 0
                      ? "No registrations yet."
                      : "No players match your filters."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.profile_picture_url ? (
                      <Image
                        src={p.profile_picture_url}
                        alt={p.full_name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md bg-muted object-contain"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.full_name}
                    {p.is_icon && (
                      <span className="ml-1.5 rounded bg-gradient-to-r from-yellow-400 to-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cricket-pitch">
                        ★ Icon
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{p.role}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.phone ?? "—"}
                  </TableCell>
                  <TableCell>{p.city}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <StatusToggle
                      id={p.id}
                      status={p.status}
                      name={p.full_name}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <PlayerEditDialog player={p} />
                      <DeleteButton id={p.id} name={p.full_name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
