import { isEventId } from "../event-id";

describe("isEventId", () => {
  it("aceita UUID em qualquer caixa", () => {
    expect(isEventId("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isEventId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it.each([
    "",
    "eventos",
    "f-1",
    "3f2504e0-4f89-41d3-9a0c-0305e82c330",
    "3f2504e04f8941d39a0c0305e82c3301",
    " 3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    "3f2504e0-4f89-41d3-9a0c-0305e82c3301\n",
    "x3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  ])("rejeita %j", (v) => expect(isEventId(v)).toBe(false));
});
