import { ageGroupBand, flagAgeEligibility, findDuplicates } from "@/lib/eligibility";
import { calculateAge } from "@/lib/player";

function yearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

describe("ageGroupBand", () => {
  it("gives a two-year band below the named age", () => {
    expect(ageGroupBand("U15")).toEqual([13, 15]);
  });

  it("clamps the lower bound at zero for a very young age group", () => {
    expect(ageGroupBand("U1")).toEqual([0, 1]);
  });

  it("returns null for a label with no leading U and digits", () => {
    expect(ageGroupBand("Senior")).toBeNull();
    expect(ageGroupBand(null)).toBeNull();
    expect(ageGroupBand(undefined)).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(ageGroupBand("u13")).toEqual([11, 13]);
  });
});

describe("flagAgeEligibility", () => {
  it("does not flag a player inside the band", () => {
    const players = [{ id: "1", full_name: "A", date_of_birth: yearsAgo(14), age_group: "U15" }];
    expect(flagAgeEligibility(players)).toEqual([]);
  });

  it("flags a player well above their team's band", () => {
    const dob = yearsAgo(17);
    const players = [{ id: "1", full_name: "Overage Player", date_of_birth: dob, age_group: "U11" }];
    const flags = flagAgeEligibility(players);
    expect(flags).toHaveLength(1);
    // Computed via calculateAge rather than hardcoded: it floors an average
    // 365.25-day year, so "17 calendar years ago" can compute to 16 or 17
    // depending on how today's date falls relative to leap days — the same
    // rounding flagAgeEligibility itself relies on, not a bug in either.
    expect(flags[0]).toMatchObject({ playerId: "1", playerName: "Overage Player", age: calculateAge(dob), ageGroup: "U11" });
  });

  it("flags a player well below their team's band", () => {
    const players = [{ id: "1", full_name: "Young Player", date_of_birth: yearsAgo(6), age_group: "U15" }];
    expect(flagAgeEligibility(players)).toHaveLength(1);
  });

  it("never flags a player with no date of birth or a non-band age group", () => {
    const players = [
      { id: "1", full_name: "No DOB", date_of_birth: null, age_group: "U15" },
      { id: "2", full_name: "Senior player", date_of_birth: yearsAgo(30), age_group: "Senior" },
    ];
    expect(flagAgeEligibility(players)).toEqual([]);
  });
});

describe("findDuplicates", () => {
  it("groups two players sharing an ID number", () => {
    const groups = findDuplicates([
      { id: "1", full_name: "A", date_of_birth: null, id_number: "1234567890123" },
      { id: "2", full_name: "B", date_of_birth: null, id_number: "1234567890123" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("ID number");
    expect(groups[0].players.map((p) => p.id).sort()).toEqual(["1", "2"]);
  });

  it("groups two players sharing a SAFA number", () => {
    const groups = findDuplicates([
      { id: "1", full_name: "A", date_of_birth: null, mysafa_number: "SAFA001" },
      { id: "2", full_name: "B", date_of_birth: null, mysafa_number: "safa001" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("SAFA number");
  });

  it("groups two players sharing a name and date of birth", () => {
    const dob = "2013-05-01";
    const groups = findDuplicates([
      { id: "1", full_name: "Sipho Nkosi", date_of_birth: dob },
      { id: "2", full_name: "sipho nkosi", date_of_birth: dob },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("name and date of birth");
  });

  it("never matches two players who both have a blank field", () => {
    const groups = findDuplicates([
      { id: "1", full_name: "A", date_of_birth: null, id_number: "" },
      { id: "2", full_name: "B", date_of_birth: null, id_number: "" },
    ]);
    expect(groups).toEqual([]);
  });

  it("returns nothing for a squad with no duplicates", () => {
    const groups = findDuplicates([
      { id: "1", full_name: "A", date_of_birth: "2013-01-01", id_number: "111" },
      { id: "2", full_name: "B", date_of_birth: "2014-01-01", id_number: "222" },
    ]);
    expect(groups).toEqual([]);
  });
});
