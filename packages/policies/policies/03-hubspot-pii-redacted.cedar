@id("03-hubspot-pii-redacted")
@asi("ASI04 Data Exfiltration")
@description("HubSpot account and contact reads are permitted only when agent-shield will apply PII redaction to the response. Mitigates leakage of PII into LLM context or downstream tool calls.")
permit (
  principal in Role::"SupportLead",
  action in [Action::"getAccount", Action::"listContacts"],
  resource is Account
)
when {
  context.responseTransform == "pii-redact"
};
