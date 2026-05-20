import { test } from "node:test";
import assert from "node:assert/strict";
import { clinicHasFeature } from "./planFeatures.ts";
import type { Feature } from "./plan.ts";

test("Free no pilot month_view → false", () => {
  assert.equal(
    clinicHasFeature({ plan: "free", is_pilot: false }, "month_view"),
    false,
  );
});

test("Starter no pilot month_view → true", () => {
  assert.equal(
    clinicHasFeature({ plan: "starter", is_pilot: false }, "month_view"),
    true,
  );
});

test("Pro no pilot month_view → true", () => {
  assert.equal(
    clinicHasFeature({ plan: "pro", is_pilot: false }, "month_view"),
    true,
  );
});

test("Pilot plan=free month_view → true (bypass aplica)", () => {
  assert.equal(
    clinicHasFeature({ plan: "free", is_pilot: true }, "month_view"),
    true,
  );
});

test("Pilot plan=starter month_view → true", () => {
  assert.equal(
    clinicHasFeature({ plan: "starter", is_pilot: true }, "month_view"),
    true,
  );
});

test("plan=null no pilot month_view → false (resolvePlan colapsa a free)", () => {
  assert.equal(
    clinicHasFeature({ plan: null, is_pilot: false }, "month_view"),
    false,
  );
});

test("is_pilot=null plan=starter month_view → true (null no activa bypass, pero starter tiene la feature)", () => {
  assert.equal(
    clinicHasFeature({ plan: "starter", is_pilot: null }, "month_view"),
    true,
  );
});

test("Pilot feature inventada foo_view → false (defensa anti-superusuario)", () => {
  assert.equal(
    clinicHasFeature(
      { plan: "starter", is_pilot: true },
      "foo_view" as Feature,
    ),
    false,
  );
});
