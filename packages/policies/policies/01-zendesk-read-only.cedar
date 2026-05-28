@id("01-zendesk-read-only")
@asi("ASI02 Tool Misuse")
@description("SupportLead may read and triage Zendesk tickets, including writing internal notes; deletes are not permitted by any policy and so are denied by default.")
permit (
  principal in Role::"SupportLead",
  action in [
    Action::"listTickets",
    Action::"getTicket",
    Action::"replyInternal",
    Action::"closeTicket"
  ],
  resource is Ticket
);
