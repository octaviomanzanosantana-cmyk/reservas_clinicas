import { test } from "node:test";
import assert from "node:assert/strict";
import { getMonthGrid, isOperatingDay } from "./dateHelpers.ts";
import type { ClinicHourRow } from "./useCalendarData.ts";

const FIXED_TODAY = new Date(2026, 4, 20); // 2026-05-20, fuera de los meses testeados salvo May

function makeHour(day_of_week: number, active = true): ClinicHourRow {
  return {
    id: String(day_of_week),
    clinic_slug: "x",
    day_of_week,
    start_time: "09:00",
    end_time: "18:00",
    active,
  };
}

test("getMonthGrid: Feb 2026 (28 días, Feb 1 = Domingo) → grid empieza Lun 26 Ene, termina Dom 8 Mar", () => {
  const grid = getMonthGrid(2026, 2, FIXED_TODAY);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].dateString, "2026-01-26");
  assert.equal(grid[0].isCurrentMonth, false);
  assert.equal(grid[0].dayOfWeek, 1);
  assert.equal(grid[6].dateString, "2026-02-01");
  assert.equal(grid[6].isCurrentMonth, true);
  assert.equal(grid[33].dateString, "2026-02-28");
  assert.equal(grid[33].isCurrentMonth, true);
  assert.equal(grid[34].dateString, "2026-03-01");
  assert.equal(grid[34].isCurrentMonth, false);
  assert.equal(grid[41].dateString, "2026-03-08");
  assert.equal(grid[41].dayOfWeek, 7);
});

test("getMonthGrid: Feb 2024 (29 días bisiesto, Feb 1 = Jueves) incluye Feb 29", () => {
  const grid = getMonthGrid(2024, 2, FIXED_TODAY);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].dateString, "2024-01-29");
  assert.equal(grid[3].dateString, "2024-02-01");
  assert.equal(grid[3].isCurrentMonth, true);
  const feb29 = grid.find((d) => d.dateString === "2024-02-29");
  assert.ok(feb29, "Feb 29 debe existir en bisiesto");
  assert.equal(feb29!.isCurrentMonth, true);
});

test("getMonthGrid: May 2026 (31 días, May 1 = Viernes) empieza Lun 27 Abr", () => {
  const grid = getMonthGrid(2026, 5, FIXED_TODAY);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].dateString, "2026-04-27");
  assert.equal(grid[4].dateString, "2026-05-01");
  assert.equal(grid[4].isCurrentMonth, true);
  assert.equal(grid[4].dayOfWeek, 5);
  const may31 = grid.find((d) => d.dateString === "2026-05-31");
  assert.ok(may31);
  assert.equal(may31!.isCurrentMonth, true);
});

test("getMonthGrid: Jun 2026 (30 días, Jun 1 = Lunes) no padding inicio", () => {
  const grid = getMonthGrid(2026, 6, FIXED_TODAY);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].dateString, "2026-06-01");
  assert.equal(grid[0].isCurrentMonth, true);
  assert.equal(grid[0].dayOfWeek, 1);
  assert.equal(grid[29].dateString, "2026-06-30");
  assert.equal(grid[29].isCurrentMonth, true);
  assert.equal(grid[30].dateString, "2026-07-01");
  assert.equal(grid[30].isCurrentMonth, false);
  assert.equal(grid[41].dateString, "2026-07-12");
});

test("getMonthGrid: Dic 2026 → primer día siguiente mes es 1 Ene 2027 con isCurrentMonth=false", () => {
  const grid = getMonthGrid(2026, 12, FIXED_TODAY);
  assert.equal(grid.length, 42);
  // Dec 1, 2026 = Tuesday (dow 2). Monday de primera fila = Nov 30, 2026.
  assert.equal(grid[0].dateString, "2026-11-30");
  assert.equal(grid[0].isCurrentMonth, false);
  const dec31 = grid.find((d) => d.dateString === "2026-12-31");
  assert.ok(dec31);
  assert.equal(dec31!.isCurrentMonth, true);
  const jan1 = grid.find((d) => d.dateString === "2027-01-01");
  assert.ok(jan1);
  assert.equal(jan1!.isCurrentMonth, false);
});

test("getMonthGrid: isToday marca exactamente el día indicado en today", () => {
  const grid = getMonthGrid(2026, 5, new Date(2026, 4, 20));
  const may20 = grid.find((d) => d.dateString === "2026-05-20");
  assert.ok(may20);
  assert.equal(may20!.isToday, true);
  const may19 = grid.find((d) => d.dateString === "2026-05-19");
  assert.equal(may19!.isToday, false);
  const may21 = grid.find((d) => d.dateString === "2026-05-21");
  assert.equal(may21!.isToday, false);
});

test("getMonthGrid: isToday no marca fuera del mes objetivo aunque today caiga en padding", () => {
  // En Feb 2026 grid, los días Mar 2-8 son padding. Si today=Mar 5, todavía debe marcarse.
  const grid = getMonthGrid(2026, 2, new Date(2026, 2, 5)); // 2026-03-05
  const mar5 = grid.find((d) => d.dateString === "2026-03-05");
  assert.ok(mar5);
  assert.equal(mar5!.isToday, true);
  assert.equal(mar5!.isCurrentMonth, false);
});

test("isOperatingDay: array vacío → false", () => {
  assert.equal(isOperatingDay(1, []), false);
});

test("isOperatingDay: 1 row active Lun → true para Lun, false para resto", () => {
  const hours = [makeHour(1)];
  assert.equal(isOperatingDay(1, hours), true);
  for (const d of [2, 3, 4, 5, 6, 7]) assert.equal(isOperatingDay(d, hours), false);
});

test("isOperatingDay: 5 rows L-V active → true L-V, false S-D", () => {
  const hours = [1, 2, 3, 4, 5].map((d) => makeHour(d));
  for (const d of [1, 2, 3, 4, 5]) assert.equal(isOperatingDay(d, hours), true);
  assert.equal(isOperatingDay(6, hours), false);
  assert.equal(isOperatingDay(7, hours), false);
});

test("isOperatingDay: row Lun con active=false → false", () => {
  const hours = [makeHour(1, false)];
  assert.equal(isOperatingDay(1, hours), false);
});
