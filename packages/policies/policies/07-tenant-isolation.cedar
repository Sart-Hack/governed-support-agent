@id("07-tenant-isolation")
@asi("ASI06 Inter-Agent / Cross-Boundary")
@description("Cross-tenant access is denied. A principal may only act on resources within its own tenant; principal.tenant must equal resource.tenant.")
forbid (
  principal,
  action,
  resource
)
when {
  principal has tenant && resource has tenant && principal.tenant != resource.tenant
};
