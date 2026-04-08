import clsx from 'clsx';
import type { ReactNode } from 'react';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';

export type AdminStatColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string | ((row: T, index: number) => string);
};

type AdminStatTableProps<T> = {
  columns: AdminStatColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  empty: ReactNode;
  className?: string;
  tableClassName?: string;
  viewportClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  emptyClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  stickyHeader?: boolean;
};

export function AdminStatTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  className,
  tableClassName,
  viewportClassName,
  headerClassName,
  bodyClassName,
  emptyClassName,
  rowClassName,
  stickyHeader = false,
}: AdminStatTableProps<T>) {
  return (
    <AdminDataTable className={className} tableClassName={tableClassName} tone="muted" viewportClassName={viewportClassName}>
      <thead className={clsx('bg-bg/70', stickyHeader && 'sticky top-0 z-10 backdrop-blur', headerClassName)}>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              className={clsx(
                'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted',
                column.headerClassName
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className={clsx('divide-y divide-border text-sm', bodyClassName)}>
        {rows.length ? (
          rows.map((row, index) => (
            <tr
              key={getRowKey(row, index)}
              className={clsx(typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={clsx(
                    'px-4 py-3 align-top',
                    typeof column.cellClassName === 'function' ? column.cellClassName(row, index) : column.cellClassName
                  )}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className={clsx('px-4 py-10 text-center text-text-secondary', emptyClassName)}>
              {empty}
            </td>
          </tr>
        )}
      </tbody>
    </AdminDataTable>
  );
}
