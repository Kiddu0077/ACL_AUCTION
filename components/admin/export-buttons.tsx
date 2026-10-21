"use client";

import * as React from "react";
import { Download, FileText, Presentation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { Player } from "@/lib/types/database";
import { TOURNAMENT_NAME, TOURNAMENT_SLUG } from "@/lib/tournament";
import { prepareExportPhoto } from "@/lib/prepare-export-photo";

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

// PowerPoint gets a bounded square JPEG with the original aspect ratio
// letterboxed inside it, so portraits neither stretch nor crop faces.
async function imageToDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await prepareExportPhoto(await res.blob());
  } catch {
    return null;
  }
}

export function ExportButtons({ players }: { players: Player[] }) {
  const { toast } = useToast();
  const busyRef = React.useRef(false);
  const [busy, setBusy] = React.useState<null | "xlsx" | "pdf" | "ppt">(null);
  const [pptProgress, setPptProgress] = React.useState(0);

  async function exportXlsx() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("xlsx");
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...asRows(players)]);
      ws["!cols"] = COLUMNS.map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Players");
      XLSX.writeFile(wb, `${TOURNAMENT_SLUG}-players-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      showExportError(error);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function exportPdf() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text(`${TOURNAMENT_NAME} — Player Registrations`, 14, 14);
      doc.setFontSize(10);
      doc.text(`Generated ${new Date().toLocaleString()}`, 14, 20);
      autoTable(doc, {
        startY: 24,
        head: [COLUMNS],
        body: asRows(players),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [19, 57, 43] },
      });
      doc.save(`${TOURNAMENT_SLUG}-players-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      showExportError(error);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function exportPpt() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("ppt");
    setPptProgress(0);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
      const tournament = TOURNAMENT_NAME;
      pptx.title = `${tournament} — Players`;
      pptx.subject = "Player roster";

      // Theme colors
      const FOREST = "13392B";
      const FOREST_DARK = "091B16";
      const LIME = "D3F36B";
      const MINT = "B8DCC4";
      const WHITE = "FFFFFF";
      const ROLE_BADGE: Record<string, string> = {
        Batsman: "EF4444",
        Bowler: "10B981",
        "All-rounder": "F59E0B",
      };

      // Keep downloads parallel without flooding a mobile connection with
      // hundreds of requests. Count completed photos so progress never regresses.
      const photos: (string | null)[] = Array(players.length).fill(null);
      let nextPhoto = 0;
      let completed = 0;
      await Promise.all(Array.from({ length: Math.min(6, players.length) }, async () => {
        while (nextPhoto < players.length) {
          const index = nextPhoto++;
          photos[index] = await imageToDataUri(players[index].profile_picture_url);
          completed += 1;
          setPptProgress(Math.round((completed / players.length) * 80));
        }
      }));

      players.forEach((p, idx) => {
        const slide = pptx.addSlide();
        slide.background = { color: FOREST };

        // Decorative diagonal accent (top-left)
        slide.addShape(pptx.ShapeType.rtTriangle, {
          x: 0,
          y: 0,
          w: 4,
          h: 1.6,
          fill: { color: FOREST_DARK },
          line: { color: FOREST_DARK },
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
          fill: { color: LIME },
          line: { color: LIME },
          rectRadius: 0.1,
        });
        slide.addText("PLAYER", {
          x: 10.3, y: 0.35, w: 2.7, h: 0.42,
          fontSize: 14, bold: true, color: FOREST,
          align: "center", valign: "bottom",
        });
        slide.addText("REGISTRATION", {
          x: 10.3, y: 0.77, w: 2.7, h: 0.42,
          fontSize: 11, bold: true, color: FOREST,
          align: "center", valign: "top",
        });

        // Player ID stripe under the header
        slide.addText(`PLAYER ID: ${String(idx + 1).padStart(3, "0")}`, {
          x: 0.4,
          y: 1.1,
          w: 6,
          h: 0.4,
          fontSize: 12,
          color: MINT,
          fontFace: "Calibri",
          bold: true,
        });

        // Left column: info rows
        const labelOpts = {
          fontSize: 11,
          color: MINT,
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
        const roleColor = ROLE_BADGE[p.role] ?? LIME;
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

        // Right side: square photo with lime frame — using `contain` so the
        // entire image fits inside the frame (no face cropping)
        const photoSize = 4.2;
        const photoX = 8.5;
        const photoY = 2.0;

        // Lime frame
        slide.addShape(pptx.ShapeType.rect, {
          x: photoX - 0.12,
          y: photoY - 0.12,
          w: photoSize + 0.24,
          h: photoSize + 0.24,
          fill: { color: LIME },
          line: { color: LIME },
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
            color: FOREST,
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
          color: MINT,
          italic: true,
          align: "center",
          fontFace: "Calibri",
        });
      });

      setPptProgress(95);
      const fileName = `${TOURNAMENT_SLUG}-players-${new Date().toISOString().slice(0, 10)}.pptx`;
      await pptx.writeFile({ fileName });
    } catch (error) {
      showExportError(error);
    } finally {
      busyRef.current = false;
      setBusy(null);
      setPptProgress(0);
    }
  }

  function showExportError(error: unknown) {
    toast({
      variant: "destructive",
      title: "Export failed",
      description: error instanceof Error ? error.message : "Please try again.",
    });
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
