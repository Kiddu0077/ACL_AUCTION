import assert from "node:assert/strict";
import test from "node:test";
import { isAuctionBusy, isAuctionManagementBusy, setAuctionBusy, setAuctionManagementBusy } from "../lib/auction/activity.ts";

test("management and auction queue locks cannot release each other", () => {
  setAuctionBusy(false);
  setAuctionManagementBusy(false);
  assert.equal(isAuctionBusy(), false);
  setAuctionManagementBusy(true);
  setAuctionBusy(true);
  setAuctionBusy(false);
  assert.equal(isAuctionBusy(), true);
  assert.equal(isAuctionManagementBusy(), true);
  setAuctionBusy(true);
  setAuctionManagementBusy(false);
  assert.equal(isAuctionBusy(), true);
  assert.equal(isAuctionManagementBusy(), false);
  setAuctionBusy(false);
  assert.equal(isAuctionBusy(), false);
});
