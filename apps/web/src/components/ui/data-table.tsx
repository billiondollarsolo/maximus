import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "#/lib/cn";
import { Icon } from "./icon";

export type { ColumnDef };

export function DataTable<T>({
  data,
  columns,
  empty,
  getRowId,
  className,
}: {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  empty?: ReactNode;
  getRowId?: (row: T, index: number) => string;
  className?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: getRowId
      ? (row, index) => getRowId(row, index)
      : undefined,
  });

  if (data.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-border-subtle",
        className,
      )}
    >
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead className="border-b border-border-subtle bg-bg-sidebar text-[12px] font-medium uppercase tracking-wide text-text-muted">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      "px-3 py-2.5 font-medium",
                      canSort && "cursor-pointer select-none hover:text-text-primary",
                    )}
                    onClick={
                      canSort
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {canSort ? (
                        <Icon
                          icon={
                            header.column.getIsSorted() === "asc"
                              ? ArrowUp
                              : header.column.getIsSorted() === "desc"
                                ? ArrowDown
                                : ArrowUpDown
                          }
                          size="sm"
                          className="opacity-50"
                        />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border-subtle last:border-0 hover:bg-bg-sidebar-hover/40"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2.5 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
