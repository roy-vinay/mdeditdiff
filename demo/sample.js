// Sample document for the website demo: a plan you read (r1), then two agents' edits (r2, r3).
(function (root) {
  "use strict";

  var r1 = [
    "# Export reports to CSV",
    "",
    "Customers want to download any report as a spreadsheet. This plan covers the first version: what we build, how we roll it out, and what we still need to decide.",
    "",
    "## Goals",
    "",
    "- Any report can be exported in one click.",
    "- No report should take more than a minute to export.",
    "- Exports respect the same permissions as the report itself.",
    "",
    "## Steps",
    "",
    "1. Add an **Export** button to the report page.",
    "2. Build the CSV on the server.",
    "3. Email a download link when an export is ready.",
    "4. Ship behind the `csv_export` feature flag.",
    "",
    "## Timeline",
    "",
    "The delivery timeline depends on the vendor's storage API. If their sandbox is ready by Friday, we can start the beta the week after. If it slips, we start with internal teams only and keep the beta date.",
    "",
    "Engineering estimates two weeks for the server work and one week for the button, the email and the flag. QA runs in parallel with the beta.",
    "",
    "## Open questions",
    "",
    "- Should exports include archived rows?",
    "- What is the row limit?",
    "- Do we need Excel files, or is CSV enough?",
    "",
    "## Rollout",
    "",
    "| Stage | Who | When |",
    "| --- | --- | --- |",
    "| Internal | Support team | Week 1 |",
    "| Beta | 10 customers | Week 2 |",
    "| Everyone | All plans | Week 4 |",
    "",
    "## Risks",
    "",
    "Large reports could overload the database during business hours. Exports could leak data if a report is shared with someone who can't see every row. Customers on older browsers may not handle large downloads well.",
    "",
    "> Keep the first version simple. Scheduled exports, other formats and custom columns can come later.",
    "",
    "## How it works",
    "",
    "The export job runs in the background and writes the file in pieces:",
    "",
    "```js",
    "for await (const page of report.pages()) {",
    "  file.write(toCsv(page.rows));",
    "}",
    "notify(user, file.downloadUrl);",
    "```",
    "",
    "## Success",
    "",
    "- [ ] 90% of exports finish in under a minute.",
    "- [ ] No permission bugs in the first month.",
    "- [x] Support has a help article ready before the beta.",
    "",
    "## Later",
    "",
    "Once the first version is stable, we'll look at scheduled exports, Excel files, and letting customers pick their own columns. Each of these needs its own plan and its own review.",
    ""
  ].join("\n");

  // r2: the planner agent adds streaming and a decision, and removes the archived-rows question.
  var r2 = r1
    .replace("2. Build the CSV on the server.", "2. Build the CSV on the server, streaming rows so large reports never time out.")
    .replace("- Should exports include archived rows?\n", "")
    .replace("- What is the row limit?", "- What is the row limit? Proposed: 100,000 rows.")
    .replace("## Rollout", "Decision: archived rows are excluded from exports.\n\n## Rollout");

  // r3: a reviewer agent widens the beta and adds a summary line at the top.
  var r3 = r2
    .replace("| Beta | 10 customers | Week 2 |", "| Beta | 25 customers | Week 2 |")
    .replace("# Export reports to CSV\n", "# Export reports to CSV\n\n**Status:** approved for the beta, pending the vendor's sandbox.\n");

  // What the Split step types into the editor.
  var typed = "4. Ship behind the `csv_export` feature flag.\n5. Add a help article and a short video.";

  root.MDDemoData = {
    file: "export-plan.md",
    texts: { r1: r1, r2: r2, r3: r3 },
    typedAfter: "4. Ship behind the `csv_export` feature flag.",
    typed: "\n5. Add a help article and a short video.",
    typedFull: typed,
    // Newest first, the way the app's history panel lists them.
    history: [
      { revision: "r3", time: "2026-10-16T17:42:00Z", source: "checkpoint", author: "reviewer", note: "Widened the beta to 25 customers" },
      { revision: "r2", time: "2026-10-16T17:05:00Z", source: "checkpoint", author: "planner", note: "Added streaming and a row limit" },
      { revision: "r1", time: "2026-10-16T15:30:00Z", source: "checkpoint", author: "you", note: "Saved in mdEditDiff" }
    ]
  };
})(window);
