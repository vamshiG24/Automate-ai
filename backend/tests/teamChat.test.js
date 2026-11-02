import { test } from "node:test";
import assert from "node:assert/strict";

import { parseMentions } from "../services/teamChat.service.js";

const team = {
  members: [
    { memberId: "m1", name: "Explainer" },
    { memberId: "m2", name: "Quiz Master" },
    { memberId: "m3", name: "Translator" },
  ],
};

test("@mention picks that member and strips the name", () => {
  const { members, text } = parseMentions(team, "@Quiz Master quiz me on probability");
  assert.deepEqual(members.map((m) => m.memberId), ["m2"]);
  assert.equal(text, "quiz me on probability");
});

test("several @mentions keep their order, case-insensitive", () => {
  const { members, text } = parseMentions(team, "@explainer @Translator: photosynthesis");
  assert.deepEqual(members.map((m) => m.memberId), ["m1", "m3"]);
  assert.equal(text, "photosynthesis");
});

test("no mention or unknown name leaves the message alone", () => {
  assert.equal(parseMentions(team, "explain probability").members.length, 0);
  assert.equal(parseMentions(team, "@Teacher explain").members.length, 0);
});
