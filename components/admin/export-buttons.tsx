"use client";

import * as React from "react";
import { Download, FileText, Presentation } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Player } from "@/lib/types/database";

const COLUMNS = [
  "Full name",
  "Role",
  "Phone",
  "City",
  "Status",
  "Registered",
];

function asRows(players: Player[]) {
  return players.map((p) => [
    p.full_name,
    p.role,
    p.phone ?? "",
    p.city,
    p.status,
    new Date(p.created_at).toLocaleString(),
  ]);
}

// Convert an image URL to a base64 data URI (PowerPoint needs base64-embedded
// images so the .pptx is self-contained when opened offline).
async function imageToDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function ExportButtons({ players }: { players: Player[] }) {
  const [busy, setBusy] = React.useState<null | "xlsx" | "pdf" | "ppt">(null);
  const [pptProgress, setPptProgress] = React.useState(0);

  async function exportXlsx() {
    setBusy("xlsx");
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...asRows(players)]);
      ws["!cols"] = COLUMNS.map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Players");
      XLSX.writeFile(wb, `acl-players-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("ACL — Player Registrations", 14, 14);
      doc.setFontSize(10);
      doc.text(`Generated ${new Date().toLocaleString()}`, 14, 20);
      autoTable(doc, {
        startY: 24,
        head: [COLUMNS],
        body: asRows(players),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 58, 138] },
      });
      doc.save(`acl-players-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  async function exportPpt() {
    setBusy("ppt");
    setPptProgress(0);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
      const tournament =
        process.env.NEXT_PUBLIC_TOURNAMENT_NAME ?? "Cricket League";
      pptx.title = `${tournament} — Players`;
      pptx.subject = "Player roster";

      // Theme colors
      const NAVY = "1E3A8A";
      const NAVY_DARK = "0F1E47";
      const YELLOW = "FBBF24";
      const TEAL = "5EEAD4";
      const WHITE = "FFFFFF";
      const ROLE_BADGE: Record<string, string> = {
        Batsman: "EF4444",
        Bowler: "10B981",
        "All-rounder": "F59E0B",
      };

      // Pre-fetch all photos in parallel (faster than serial slide-by-slide).
      const photos = await Promise.all(
        players.map(async (p, i) => {
          const uri = await imageToDataUri(p.profile_picture_url);
          setPptProgress(Math.round(((i + 1) / players.length) * 80));
          return uri;
        }),
      );

      players.forEach((p, idx) => {
        const slide = pptx.addSlide();
        slide.background = { color: NAVY };

        // Decorative diagonal accent (top-left)
        slide.addShape(pptx.ShapeType.rtTriangle, {
          x: 0,
          y: 0,
          w: 4,
          h: 1.6,
          fill: { color: NAVY_DARK },
          line: { color: NAVY_DARK },
        });

        // Tournament header
        slide.addText(tournament.toUpperCase(), {
          x: 0.4,
          y: 0.35,
          w: 9,
          h: 0.6,
          fontSize: 22,
          bold: true,
          color: WHITE,
          fontFace: "Calibri",
        });

        // "PLAYER REGISTRATION" badge (top-right)
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 10.3,
          y: 0.35,
          w: 2.7,
          h: 0.85,
          fill: { color: YELLOW },
          line: { color: YELLOW },
          rectRadius: 0.1,
        });
        slide.addText("PLAYER", {
          x: 10.3, y: 0.35, w: 2.7, h: 0.42,
          fontSize: 14, bold: true, color: NAVY,
          align: "center", valign: "bottom",
        });
        slide.addText("REGISTRATION", {
          x: 10.3, y: 0.77, w: 2.7, h: 0.42,
          fontSize: 11, bold: true, color: NAVY,
          align: "center", valign: "top",
        });

        // Player ID stripe under the header
        slide.addText(`PLAYER ID: ${String(idx + 1).padStart(3, "0")}`, {
          x: 0.4,
          y: 1.1,
          w: 6,
          h: 0.4,
          fontSize: 12,
          color: TEAL,
          fontFace: "Calibri",
          bold: true,
        });

        // Left column: info rows
        const labelOpts = {
          fontSize: 11,
          color: TEAL,
          bold: true,
          fontFace: "Calibri",
        } as const;
        const valueOpts = {
          fontSize: 26,
          color: WHITE,
          bold: true,
          fontFace: "Calibri",
        } as const;

        // NAME
        slide.addText("NAME", { x: 0.5, y: 2.0, w: 6, h: 0.35, ...labelOpts });
        slide.addText(p.full_name.toUpperCase(), {
          x: 0.5, y: 2.35, w: 6.5, h: 0.85, ...valueOpts,
        });

        // ROLE — with colored pill
        slide.addText("ROLE", { x: 0.5, y: 3.35, w: 6, h: 0.35, ...labelOpts });
        const roleColor = ROLE_BADGE[p.role] ?? YELLOW;
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.5,
          y: 3.7,
          w: 3.4,
          h: 0.8,
          fill: { color: roleColor },
          line: { color: roleColor },
          rectRadius: 0.1,
        });
        slide.addText(p.role.toUpperCase(), {
          x: 0.5, y: 3.7, w: 3.4, h: 0.8,
          fontSize: 20, bold: true, color: WHITE,
          align: "center", valign: "middle",
          fontFace: "Calibri",
        });

        // PLACE
        slide.addText("PLACE", { x: 0.5, y: 4.7, w: 6, h: 0.35, ...labelOpts });
        slide.addText(p.city.toUpperCase(), {
          x: 0.5, y: 5.05, w: 6.5, h: 0.85, ...valueOpts,
        });

        // Right side: square photo with yellow frame — using `contain` so the
        // entire image fits inside the frame (no face cropping)
        const photoSize = 4.2;
        const photoX = 8.5;
        const photoY = 2.0;

        // Yellow frame
        slide.addShape(pptx.ShapeType.rect, {
          x: photoX - 0.12,
          y: photoY - 0.12,
          w: photoSize + 0.24,
          h: photoSize + 0.24,
          fill: { color: YELLOW },
          line: { color: YELLOW },
        });

        // White inner backdrop so letterbox space looks intentional
        slide.addShape(pptx.ShapeType.rect, {
          x: photoX,
          y: photoY,
          w: photoSize,
          h: photoSize,
          fill: { color: WHITE },
          line: { color: WHITE },
        });

        if (photos[idx]) {
          slide.addImage({
            data: photos[idx]!,
            x: photoX,
            y: photoY,
            w: photoSize,
            h: photoSize,
            sizing: { type: "contain", w: photoSize, h: photoSize },
          });
        } else {
          slide.addText("NO PHOTO", {
            x: photoX,
            y: photoY,
            w: photoSize,
            h: photoSize,
            fontSize: 14,
            color: NAVY,
            align: "center",
            valign: "middle",
            fontFace: "Calibri",
          });
        }

        // Footer
        slide.addText(tournament, {
          x: 0.4,
          y: 7.0,
          w: 12.5,
          h: 0.3,
          fontSize: 9,
          color: TEAL,
          italic: true,
          align: "center",
          fontFace: "Calibri",
        });
      });

      setPptProgress(95);
      const fileName = `acl-players-${new Date().toISOString().slice(0, 10)}.pptx`;
      await pptx.writeFile({ fileName });
    } finally {
      setBusy(null);
      setPptProgress(0);
    }
  }

  const empty = players.length === 0;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportXlsx}
        disabled={empty || busy !== null}
      >
        <Download className="h-4 w-4" />
        {busy === "xlsx" ? "Exporting…" : "Excel"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportPdf}
        disabled={empty || busy !== null}
      >
        <FileText className="h-4 w-4" />
        {busy === "pdf" ? "Exporting…" : "PDF"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportPpt}
        disabled={empty || busy !== null}
      >
        <Presentation className="h-4 w-4" />
        {busy === "ppt"
          ? pptProgress > 0
            ? `${pptProgress}%`
            : "Exporting…"
          : "PPT"}
      </Button>
    </div>
  );
}
