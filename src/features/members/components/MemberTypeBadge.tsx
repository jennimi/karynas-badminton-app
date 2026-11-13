import { Badge } from '../../../shared/ui/badge';
import { memberTypeInfo, type MemberTypeResult } from '../memberType';

/** Coloured label for a member's type; hover shows the rule and their numbers. */
export function MemberTypeBadge({ result }: { result?: MemberTypeResult }) {
  if (!result) return null;
  const info = memberTypeInfo[result.type];
  return (
    <Badge variant={info.variant} title={`${info.blurb}\n${result.why}`}>
      {info.label}
    </Badge>
  );
}
