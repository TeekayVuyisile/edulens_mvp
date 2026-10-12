import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "../lib/http";
import { mockApi, renderApp, SCHOOL_ADMIN } from "./utils";

const learner = (id, first, extra = {}) => ({
  learner_id: id,
  first_name: first,
  last_name: "Test",
  average: 70,
  needs_review: false,
  ...extra,
});

const OVERVIEW = {
  fromYear: 2026,
  toYear: 2027,
  rollover: null,
  nextClasses: [
    {
      class_id: "n-2a",
      class_name: "Grade 2A",
      grade_level: "2",
      learner_count: 0,
      max_capacity: 30,
    },
    {
      class_id: "n-1a",
      class_name: "Grade 1A",
      grade_level: "1",
      learner_count: 0,
      max_capacity: 30,
    },
  ],
  classes: [
    {
      class_id: "c-1a",
      class_name: "Grade 1A",
      grade_level: "1",
      suggestion: { outcome: "promote", class_id: "n-2a" },
      learners: [
        learner("l-1", "Anele"),
        learner("l-2", "Bongi", { average: 32, needs_review: true }),
      ],
    },
    {
      class_id: "c-3a",
      class_name: "Grade 3A",
      grade_level: "3",
      suggestion: { outcome: "graduate", class_id: null },
      learners: [learner("l-3", "Cebo")],
    },
  ],
};

const asSchoolAdmin = (routes) => {
  tokenStore.set("school-token");
  return mockApi({
    "GET /api/auth/profile": {
      status: "success",
      data: { user: SCHOOL_ADMIN },
    },
    ...routes,
  });
};

describe("Year end", () => {
  it("starts from the suggestions, lets a learner repeat, and sends every decision", async () => {
    const user = userEvent.setup();
    const sent = [];
    asSchoolAdmin({
      "GET /api/school-admin/year-end": { status: "success", data: OVERVIEW },
      "POST /api/school-admin/year-end/complete": ({ body }) => {
        sent.push(body);
        return {
          status: "success",
          message: "2026 is closed",
          data: { summary: {} },
        };
      },
    });

    renderApp("/school-admin/year-end");

    expect(
      await screen.findByRole("heading", { name: "Close 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Discuss repeating")).toBeInTheDocument();
    expect(screen.getByLabelText("2027 class for Anele Test")).toHaveValue(
      "n-2a",
    );
    expect(screen.getByLabelText("Outcome for Cebo Test")).toHaveValue(
      "graduate",
    );

    await user.selectOptions(
      screen.getByLabelText("Outcome for Bongi Test"),
      "repeat",
    );
    expect(screen.getByLabelText("2027 class for Bongi Test")).toHaveValue(
      "n-1a",
    );

    await user.click(screen.getByRole("button", { name: /Close 2026/ }));
    const dialog = await screen.findByRole("dialog", {
      name: "Close 2026 and start 2027?",
    });
    expect(
      within(dialog).getByText(
        /1 learner promoted, 1 learner repeating, 1 learner finished Grade 3/,
      ),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Close 2026" }),
    );

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      from_year: 2026,
      decisions: [
        { learner_id: "l-1", outcome: "promote", class_id: "n-2a" },
        { learner_id: "l-2", outcome: "repeat", class_id: "n-1a" },
        { learner_id: "l-3", outcome: "graduate", class_id: null },
      ],
    });
  });

  it("warns when a grade has no class next year and offers to copy this year's classes", async () => {
    const user = userEvent.setup();
    const requests = asSchoolAdmin({
      "GET /api/school-admin/year-end": {
        status: "success",
        data: { ...OVERVIEW, nextClasses: [] },
      },
      "POST /api/school-admin/year-end/next-classes": {
        status: "success",
        message: "2 classes created for 2027",
        data: {},
      },
    });

    renderApp("/school-admin/year-end");

    expect(
      await screen.findByText(/no Grade 2 class for 2027 yet/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Copy 2026’s classes into 2027/ }),
    );

    await waitFor(() =>
      expect(requests.some((r) => r.method === "POST")).toBe(true),
    );
    expect(requests.find((r) => r.method === "POST").body).toEqual({
      from_year: 2026,
      copy_teachers: true,
    });
  });

  it("shows the result once the year is closed", async () => {
    asSchoolAdmin({
      "GET /api/school-admin/year-end": {
        status: "success",
        data: {
          ...OVERVIEW,
          rollover: {
            completed_at: "2026-12-05T10:00:00Z",
            completed_by_first_name: "Lindiwe",
            completed_by_last_name: "Mokoena",
            summary: {
              promote: 40,
              repeat: 2,
              graduate: 20,
              leave: 1,
              unplaced: 0,
            },
          },
        },
      },
    });

    renderApp("/school-admin/year-end");

    expect(await screen.findByText("2027 is under way")).toBeInTheDocument();
    expect(
      screen.getByText(/closed on 0?5 Dec 2026 by Lindiwe Mokoena/),
    ).toBeInTheDocument();
  });
});
