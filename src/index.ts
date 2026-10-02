/**
 * @sudobility/raidr_lib - Business logic for raidr apps
 *
 * Catalog hooks (search + pagination state), MCP/skill/site detail hooks,
 * connection snippets for MCP clients, and skill install instructions.
 * No UI components.
 *
 * Layer: raidr_types -> raidr_client -> raidr_lib -> raidr_app. Hooks read
 * through raidr_client's hooks (never fetch directly) and take the
 * NetworkClient and base URL as options, so the app decides where they come
 * from. This file is the whole public API: anything not exported here is
 * private.
 */

export { CATALOG_PAGE_SIZE, type CatalogResult } from './hooks/catalog';
export {
  useMcpCatalog,
  type UseMcpCatalogOptions,
} from './hooks/useMcpCatalog';
export {
  useSkillCatalog,
  type UseSkillCatalogOptions,
} from './hooks/useSkillCatalog';
export {
  useSiteCatalog,
  type UseSiteCatalogOptions,
} from './hooks/useSiteCatalog';
export { useMcp, type UseMcpOptions, type UseMcpResult } from './hooks/useMcp';
export {
  useSkill,
  type UseSkillOptions,
  type UseSkillResult,
} from './hooks/useSkill';
export {
  useSite,
  type UseSiteOptions,
  type UseSiteResult,
} from './hooks/useSite';

export {
  type CatalogFilter,
  type CatalogKind,
  useCatalogFilterStore,
} from './stores/catalogFilterStore';

export {
  buildConnectConfigs,
  type ConnectConfigs,
  type ConnectConfigsInput,
  API_KEY_PLACEHOLDER,
  mcpServerName,
  shellQuote,
  SITE_TOKEN_PLACEHOLDER,
} from './utils/connectConfigs';
export {
  type SkillInstallInput,
  type SkillInstallInstructions,
  skillDirectoryName,
  skillInstallInstructions,
  skillMarkdownUrl,
} from './utils/skillInstall';
export { detailState, isNotFoundError } from './utils/errors';
export {
  formatToolRequest,
  formatToolSignature,
  isMutatingTool,
  type ToolInputField,
  toolInputFields,
} from './utils/tools';

// API playground
export { toDomainEntry, type DomainEntry } from './utils/domains';
export {
  groupEndpoints,
  type EndpointGroup,
  type EndpointListItem,
} from './utils/endpoints';
export {
  useDomains,
  type UseDomainsOptions,
  type UseDomainsResult,
} from './hooks/useDomains';
export {
  useApiInspector,
  type UseApiInspectorOptions,
  type UseApiInspectorResult,
} from './hooks/useApiInspector';
export {
  useEndpointPlayground,
  type UseEndpointPlaygroundOptions,
  type UseEndpointPlaygroundResult,
} from './hooks/useEndpointPlayground';
export {
  paramControl,
  validateParam,
  coerceParam,
  paramPlaceholder,
  buildExecute,
  type ParamControl,
  type BuiltExecute,
} from './utils/params';
export {
  createCredentialStore,
  browserStorage,
  openLoginWindow,
  type CredentialStore,
  type CredentialKind,
  type KeyValueStorage,
} from './utils/credentials';
export {
  useSkillBySlug,
  type UseSkillBySlugOptions,
  type UseSkillBySlugResult,
} from './hooks/useSkillBySlug';
export {
  buildFlowGraph,
  assignColumns,
  MAX_FLOW_NODES,
  LOGIN_NODE_ID,
  type FlowGraph,
  type FlowNode,
  type FlowEdge,
} from './utils/flow';
