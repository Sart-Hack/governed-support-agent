/**
 * The MCP tool `_meta` key under which a server advertises the scopes a caller
 * must hold to invoke that tool. This is the single wire contract between an
 * MCP server (which stamps it) and a governed client (which reads it for scope
 * discovery). Defined here, in the governance layer, because the `agent-shield/`
 * namespace is owned by agent-shield: if this key drifts between producer and
 * consumer, scope discovery silently returns no scopes and the gate fails open.
 */
export const REQUIRED_SCOPES_META_KEY = "agent-shield/requiredScopes";

export interface RequiredScope {
  resource: string;
  scopes: string[];
}

export interface ScopeCheck {
  hasScopes(required: RequiredScope): Promise<boolean> | boolean;
}

export class AllowAllScopeCheck implements ScopeCheck {
  hasScopes(_required?: RequiredScope): boolean {
    return true;
  }
}

/**
 * Set-based scope check: the caller is granted a fixed set of scope tokens
 * (e.g. "zendesk:read", "notion:search"). A tool is permitted only when every
 * scope it declares in its MCP `_meta` is present in the grant. This is the
 * least-privilege enforcer behind the demo's scope-denial scenarios — the
 * agent's principal is granted read scopes but not, say, "hubspot:delete", so
 * an attempt to call a delete tool is denied before it ever reaches the server.
 */
export class GrantedScopeCheck implements ScopeCheck {
  private readonly granted: Set<string>;

  constructor(grantedScopes: Iterable<string>) {
    this.granted = new Set(grantedScopes);
  }

  hasScopes(required: RequiredScope): boolean {
    return required.scopes.every((scope) => this.granted.has(scope));
  }

  /** The scopes this check would grant, for display on the permission matrix. */
  scopes(): string[] {
    return [...this.granted];
  }
}
