import { groupByDateGroups } from "@maximus/domain";
import { ScrollArea } from "#/components/ui";
import {
  FAKE_CONVERSATIONS,
  type FakeConversation,
} from "./fake-conversations";
import { ConversationRow } from "./conversation-row";

export function ConversationList({
  collapsed,
  activeId,
  onSelect,
  items = FAKE_CONVERSATIONS,
}: {
  collapsed: boolean;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  items?: FakeConversation[];
}) {
  if (collapsed) {
    return (
      <ScrollArea className="flex-1 px-1">
        <div className="flex flex-col gap-0.5 py-1">
          {items.map((c) => (
            <ConversationRow
              key={c.id}
              title={c.title}
              collapsed
              active={c.id === activeId}
              onSelect={() => onSelect?.(c.id)}
            />
          ))}
        </div>
      </ScrollArea>
    );
  }

  const groups = groupByDateGroups(items);

  return (
    <ScrollArea className="flex-1 px-2">
      <div className="flex flex-col gap-4 py-2">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-1 px-2 text-xs font-medium text-text-muted">
              {group.label}
            </h2>
            <div className="flex flex-col gap-0.5">
              {group.items.map((c) => (
                <ConversationRow
                  key={c.id}
                  title={c.title}
                  active={c.id === activeId}
                  onSelect={() => onSelect?.(c.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}
