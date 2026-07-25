export default function DataTable({ columns, rows, getRowId, emptyMessage = 'Nenhum registro encontrado.' }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border text-text-secondary">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-panel">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={getRowId(row)} className="transition-colors hover:bg-bg">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 align-middle">
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
