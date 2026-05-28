export interface RequiredScope {
  resource: string;
  scopes: string[];
}

export interface ScopeCheck {
  hasScopes(required: RequiredScope): Promise<boolean> | boolean;
}

export class AllowAllScopeCheck implements ScopeCheck {
  hasScopes(): boolean {
    return true;
  }
}
