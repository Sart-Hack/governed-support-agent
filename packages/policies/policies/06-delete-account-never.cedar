@id("06-delete-account-never")
@asi("ASI10 Rogue Agents")
@description("Hard forbid on destructive deletion of customer records. This is the will-not-automate line per trust-system.md §1; no human-approval branch overrides it.")
forbid (
  principal,
  action in [Action::"deleteAccount", Action::"deleteUser"],
  resource
);
