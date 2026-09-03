import type { AgentMediaItem } from '../../frontend/src/server/agent-api/media-types';
import type { AgentMediaKind } from '../../frontend/src/server/agent-api/media-types';
import type { CanonicalReferenceMediaKind } from '../../frontend/src/server/agent-api/generation-types';
import type { ResolvedReference } from '../../frontend/src/server/agent-api/reference-types';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? (<Value>() => Value extends Right ? 1 : 2) extends
      (<Value>() => Value extends Left ? 1 : 2)
      ? true
      : false
    : false;

type Assert<Condition extends true> = Condition;

type ExpectedAgentMediaItem = {
  assetId: string;
  kind: 'image' | 'video' | 'audio';
  label: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  mimeType: string;
  previewUrl: string | null;
  source: 'upload' | 'generated' | 'imported';
  createdAt: string;
};

type ExpectedAgentMediaKeys =
  | 'assetId'
  | 'kind'
  | 'label'
  | 'width'
  | 'height'
  | 'durationSec'
  | 'mimeType'
  | 'previewUrl'
  | 'source'
  | 'createdAt';

type ForbiddenPublicMediaKeys =
  | 'storageUrl'
  | 'originUrl'
  | 'sourceUrl'
  | 'providerUrl'
  | 'resourceUrl'
  | 'credentials';

type _AgentMediaShapeIsExact = Assert<
  Equal<AgentMediaItem, ExpectedAgentMediaItem>
>;
type _AgentMediaKeysAreExact = Assert<
  Equal<keyof AgentMediaItem, ExpectedAgentMediaKeys>
>;
type _AgentMediaKindAliasesCanonicalKind = Assert<
  Equal<AgentMediaKind, CanonicalReferenceMediaKind>
>;
type _AgentMediaKindIsExact = Assert<
  Equal<AgentMediaItem['kind'], 'image' | 'video' | 'audio'>
>;
type _AgentMediaSourceIsExact = Assert<
  Equal<AgentMediaItem['source'], 'upload' | 'generated' | 'imported'>
>;
type _AgentMediaHasNoForbiddenPublicField = Assert<
  Equal<Extract<keyof AgentMediaItem, ForbiddenPublicMediaKeys>, never>
>;
type _AgentMediaHasNoStringIndex = Assert<
  Equal<string extends keyof AgentMediaItem ? true : false, false>
>;
type _AgentMediaHasNoNumberIndex = Assert<
  Equal<number extends keyof AgentMediaItem ? true : false, false>
>;
type _AgentMediaHasNoSymbolIndex = Assert<
  Equal<symbol extends keyof AgentMediaItem ? true : false, false>
>;

type ExpectedReferenceRole = 'source' | 'reference' | 'first_frame' | 'last_frame' | 'mask';
type ExpectedReferenceMediaKind = 'image' | 'video' | 'audio';

type ExpectedResolvedReference = {
  assetId: string;
  role: ExpectedReferenceRole;
  slot?: number;
  mediaKind: ExpectedReferenceMediaKind;
  storageUrl: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  mimeType: string;
  sizeBytes?: number | null;
  originalName?: string | null;
};

type ExpectedResolvedReferenceKeys =
  | 'assetId'
  | 'role'
  | 'slot'
  | 'mediaKind'
  | 'storageUrl'
  | 'width'
  | 'height'
  | 'durationSec'
  | 'mimeType'
  | 'sizeBytes'
  | 'originalName';

type ForbiddenResolvedReferenceKeys =
  | 'previewUrl'
  | 'resourceUrl'
  | 'originUrl'
  | 'providerUrl'
  | 'credentials';

type _ResolvedReferenceShapeIsExact = Assert<
  Equal<ResolvedReference, ExpectedResolvedReference>
>;
type _ResolvedReferenceKeysAreExact = Assert<
  Equal<keyof ResolvedReference, ExpectedResolvedReferenceKeys>
>;
type _ResolvedReferenceRoleIsExact = Assert<
  Equal<ResolvedReference['role'], ExpectedReferenceRole>
>;
type _ResolvedReferenceMediaKindIsExact = Assert<
  Equal<ResolvedReference['mediaKind'], ExpectedReferenceMediaKind>
>;
type _ResolvedReferenceHasNoForbiddenField = Assert<
  Equal<Extract<keyof ResolvedReference, ForbiddenResolvedReferenceKeys>, never>
>;
type _ResolvedReferenceHasNoStringIndex = Assert<
  Equal<string extends keyof ResolvedReference ? true : false, false>
>;
type _ResolvedReferenceHasNoNumberIndex = Assert<
  Equal<number extends keyof ResolvedReference ? true : false, false>
>;
type _ResolvedReferenceHasNoSymbolIndex = Assert<
  Equal<symbol extends keyof ResolvedReference ? true : false, false>
>;

export {};
