@id("05-customer-facing-requires-approval")
@asi("ASI03 Delegated Trust")
@description("Customer-facing actions are denied unless a human approval has been recorded in the request context. The approval state lives in the HITL workflow context and is set when the lead clicks Approve in Slack.")
forbid (
  principal,
  action in [Action::"replyPublic", Action::"sendEmail"],
  resource
)
when {
  context.humanApprovalState != "approved"
};
