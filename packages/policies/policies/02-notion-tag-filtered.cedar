@id("02-notion-tag-filtered")
@asi("ASI01 Agent Goal Hijack")
@description("Notion reads are limited to pages tagged public or support-kb. Limits the reachable content surface for indirect prompt injection from KB poisoning.")
permit (
  principal in Role::"SupportLead",
  action in [Action::"search", Action::"getPage"],
  resource is KBPage
)
when {
  resource.tag == "public" || resource.tag == "support-kb"
};
