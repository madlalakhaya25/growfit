import { scrubEvent, scrubText } from "../sentry-scrub";

describe("scrubText", () => {
  it("strips emails, long numbers and Postgres key details, and caps length", () => {
    expect(scrubText("Parent a.b@example.com failed")).toBe("Parent [email] failed");
    expect(scrubText("ID 0001015800086 and phone 082 123 4567")).toBe("ID [number] and phone [number]");
    expect(scrubText('duplicate key value violates unique constraint "x" Key (id_number)=(0001015800086) already exists')).not.toMatch(/0001015800086|id_number/);
    expect(scrubText("x".repeat(900))).toHaveLength(500);
  });
  it("leaves ordinary diagnostics alone", () => {
    expect(scrubText("relation family_messages does not exist (42P01)")).toBe("relation family_messages does not exist (42P01)");
  });
});

describe("scrubEvent", () => {
  it("scrubs message, exception, extras and breadcrumbs, and drops request body, cookies, headers and user", () => {
    const out = scrubEvent({
      message: "Parent a.b@example.com failed",
      exception: { values: [{ value: "ID 0001015800086 not found" }, {}] },
      extra: { note: "call 082 123 4567", nested: { who: "x@y.co" }, n: 3 },
      breadcrumbs: [{ message: "sent to a.b@example.com", data: { id: "0001015800086" } }],
      request: { url: "/p", data: { name: "Sipho" }, cookies: "sb=1", headers: { a: "b" }, query_string: "q=1" },
      user: { id: "u1", ip_address: "1.2.3.4" },
    });
    expect(out.message).toBe("Parent [email] failed");
    expect(out.exception?.values?.[0].value).toBe("ID [number] not found");
    expect(out.extra).toEqual({ note: "call [number]", nested: { who: "[email]" }, n: 3 });
    expect(out.breadcrumbs?.[0]).toEqual({ message: "sent to [email]", data: { id: "[number]" } });
    expect(out.request).toEqual({ url: "/p" });
    expect(out).not.toHaveProperty("user");
  });
  it("does not mutate the event it was given", () => {
    const event = { message: "a@b.co", user: { id: "u" } };
    scrubEvent(event);
    expect(event).toEqual({ message: "a@b.co", user: { id: "u" } });
  });
});
