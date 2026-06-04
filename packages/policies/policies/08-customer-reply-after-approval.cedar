@id("08-customer-reply-after-approval")
@asi("ASI03 Delegated Trust")
@description("Customer-facing replies are permitted once a human has recorded approval in the request context. Pairs with policy 05: without approval policy 05's forbid wins; with approval this permit applies. Cross-tenant access is still denied by policy 07.")
permit (
  principal in Role::"SupportLead",
  action in [Action::"replyPublic", Action::"sendEmail"],
  resource is Ticket
)
when {
  context.humanApprovalState == "approved"
};
