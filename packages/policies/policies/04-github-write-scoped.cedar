@id("04-github-write-scoped")
@asi("ASI02 Tool Misuse")
@description("Engineer role may create or update issues in the support repository, but never on P0 severity (those route to humans).")
permit (
  principal in Role::"Engineer",
  action in [Action::"createIssue", Action::"updateIssue", Action::"listProjects"],
  resource is Repo
)
when {
  resource.name == "support" && context.severity != "P0"
};
