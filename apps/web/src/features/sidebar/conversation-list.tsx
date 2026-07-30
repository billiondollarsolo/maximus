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
      <ScrollArea className="flex-1 px-1.5">
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

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-start px-3 py-4">
        <p className="text-[13px] text-text-faint">No chats yet</p>
      </div>
    );
  }

  const groups = groupByDateGroups(items);

  return (
    <ScrollArea className="flex-1 px-2">
      <div className="flex flex-col gap-4 py-1 pb-3">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wide text-text-faint">
              {group.label}
            </h2>
            <div className="flex flex-col gap-px">
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
